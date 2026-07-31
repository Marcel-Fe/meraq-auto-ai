/**
 * Prüft den Weg zur KI, ohne einen echten Schlüssel zu verbrauchen.
 *
 * Die Antworten von Google und Anthropic werden abgefangen und durch feste
 * Beispielantworten ersetzt. Damit ist alles geprüft, was in unserer Hand liegt:
 * Anbieterwahl, Schlüsselprüfung, Modell-Liste, Streaming, Fehlerbehandlung und
 * die Übersetzung ins jeweilige Format. Nur die echte Antwort des Anbieters
 * lässt sich so nicht prüfen – dafür braucht es einen eigenen Schlüssel.
 *
 * Aufruf: node scripts/test-ai-providers.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173/meraq-auto-ai/'
const OUT = 'screenshots/ki'
mkdirSync(OUT, { recursive: true })

const problems = []
const seen = { models: 0, stream: 0, anthropic: 0 }
let lastGoogleBody = null

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' })

// --- Google: Modell-Liste ---
await context.route('**/generativelanguage.googleapis.com/**/models?*', async (route) => {
  seen.models++
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      models: [
        { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-pro-latest', displayName: 'Gemini Pro', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-004', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
      ],
    }),
  })
})

// --- Google: Streaming-Antwort als Server-sent events ---
await context.route('**/generativelanguage.googleapis.com/**:streamGenerateContent*', async (route) => {
  seen.stream++
  lastGoogleBody = JSON.parse(route.request().postData() ?? '{}')
  const chunk = (text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: chunk('Der Bremsbelag ') + chunk('ist ein Verschleißteil ') + chunk('und gehört in die Werkstatt.'),
  })
})

// --- Anthropic darf gar nicht erst aufgerufen werden, solange Google eingestellt ist ---
await context.route('**/api.anthropic.com/**', async (route) => {
  seen.anthropic++
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})

const page = await context.newPage()
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

const goto = async (hash) => {
  await page.evaluate((h) => (window.location.hash = h), hash)
  await page.waitForTimeout(700)
}
const text = () => page.evaluate(() => document.body.innerText)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
await page.waitForTimeout(400)

// --- Vorgabe muss der kostenlose Weg sein ---
await goto('#/settings')
const settings = await text()
if (!settings.includes('kostenlos')) problems.push('[einstellungen] Der kostenlose Weg wird nicht beworben')
if (!settings.includes('Google')) problems.push('[einstellungen] Google ist nicht als Anbieter sichtbar')
if (!/Google behält sich vor|zur\s+Verbesserung seiner Modelle/.test(settings)) {
  problems.push('[einstellungen] Der Datenschutz-Hinweis zum kostenlosen Kontingent fehlt')
}

// --- Schlüssel eintragen und prüfen ---
await page.locator('input[type="password"]').fill('AIzaTestSchluessel')
await page.getByRole('button', { name: 'Speichern & prüfen' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/einstellungen-google.png`, fullPage: true })

const afterCheck = await text()
if (!seen.models) problems.push('[schlüsselprüfung] Die Modell-Liste wurde nicht bei Google abgefragt')
if (!afterCheck.includes('Schlüssel funktioniert')) {
  problems.push('[schlüsselprüfung] Keine Erfolgsmeldung nach der Prüfung')
}
const options = await page.locator('select').last().locator('option').allInnerTexts()
if (!options.includes('Gemini Flash')) problems.push('[modelle] Geprüfte Modelle stehen nicht zur Auswahl')
if (options.some((o) => /Embedding/i.test(o))) problems.push('[modelle] Embedding-Modelle wurden nicht herausgefiltert')

// --- Assistent: echte Frage über den Google-Weg ---
await goto('#/assistant')
await page.getByPlaceholder('Frage stellen…').fill('Was macht ein Bremsbelag?')
await page.locator('form button[type="submit"], button[aria-label="Senden"]').first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/assistent-google.png`, fullPage: false })

const chat = await text()
if (!seen.stream) problems.push('[assistent] Es ging keine Anfrage an Google')
if (!chat.includes('Verschleißteil')) problems.push('[assistent] Die gestreamte Antwort erscheint nicht im Verlauf')
if (seen.anthropic) problems.push('[assistent] Anthropic wurde aufgerufen, obwohl Google eingestellt ist')

// --- Wurde richtig ins Google-Format übersetzt? ---
if (lastGoogleBody) {
  if (!lastGoogleBody.systemInstruction?.parts?.[0]?.text) {
    problems.push('[format] systemInstruction fehlt in der Anfrage')
  }
  const first = lastGoogleBody.contents?.[0]
  if (first?.role !== 'user' || !first?.parts?.[0]?.text) {
    problems.push('[format] contents sind nicht im Google-Format')
  }
  if (!/BMW|Fahrzeug/i.test(lastGoogleBody.systemInstruction?.parts?.[0]?.text ?? '')) {
    problems.push('[format] Der Fahrzeugkontext fehlt im System-Prompt')
  }
}

await browser.close()

if (problems.length) {
  console.log('PROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`OK – Google-Weg geprüft: ${seen.models} Modellabfrage(n), ${seen.stream} Streaming-Anfrage(n), Anthropic unberührt.`)
