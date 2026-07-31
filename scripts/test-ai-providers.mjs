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
const seen = { models: 0, stream: 0, structured: 0, anthropic: 0 }
let lastGoogleBody = null
let lastStructuredBody = null
let lastStructuredModel = null
/** 'ok' | 'unknown-model' – simuliert ein von Google abgeschaltetes Modell */
let structuredMode = 'ok'

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

// --- Google: strukturierte Antwort über einen erzwungenen Funktionsaufruf ---
await context.route('**/generativelanguage.googleapis.com/**:generateContent*', async (route) => {
  seen.structured++
  lastStructuredBody = JSON.parse(route.request().postData() ?? '{}')
  lastStructuredModel = decodeURIComponent(
    route.request().url().match(/models\/([^:]+):/)?.[1] ?? '',
  )

  // Beim ersten Versuch tut das Modell so, als haette Google es abgeschaltet.
  // Die App muss daraufhin die Liste holen und still auf ein gueltiges wechseln.
  if (structuredMode === 'unknown-model' && lastStructuredModel !== 'gemini-flash-latest') {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 404, message: 'models/alt is not found for API version v1beta' } }),
    })
    return
  }

  // Antwort passend zum angeforderten Werkzeug – so wie das echte Modell es täte
  const toolName = lastStructuredBody?.tools?.[0]?.functionDeclarations?.[0]?.name
  const args =
    toolName === 'fahrzeug_steckbrief'
      ? {
          summary: 'Solider Mittelklassewagen mit bekannten Schwächen.',
          strengths: ['Sparsamer Motor', 'Viel Platz'],
          weakspots: [
            { title: 'Steuerkette längt sich', detail: 'Rasseln beim Kaltstart.', typicalKm: 'ab 120.000 km', costRange: '900–1.800 €' },
          ],
          checkBeforeBuying: ['Kaltstart anhören', 'Serviceheft prüfen'],
          runningCosts: 'Teile sind gut verfügbar, der Verbrauch liegt im Rahmen.',
          verdict: 'Kaufen, wenn die Steuerkette nachweislich gemacht wurde.',
          certainty: 'gut bekannt',
        }
      : { summary: 'Ölwechsel', services: ['Motoröl'], totalGrossEur: 289.9 }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      candidates: [{ content: { parts: [{ functionCall: { name: toolName, args } }] } }],
    }),
  })
})

// --- Anthropic: darf nur drankommen, wenn er auch eingestellt ist ---
let lastAnthropicBody = null
await context.route('**/api.anthropic.com/**', async (route) => {
  seen.anthropic++
  lastAnthropicBody = JSON.parse(route.request().postData() ?? '{}')

  // Nicht-Streaming (Schlüsselprüfung) erwartet eine gewöhnliche JSON-Antwort
  if (!lastAnthropicBody.stream) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-5',
        content: [{ type: 'text', text: 'OK' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 1 },
      }),
    })
    return
  }

  const event = (type, data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  await route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body:
      event('message_start', {
        type: 'message_start',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-5',
          content: [],
          stop_reason: null,
          usage: { input_tokens: 5, output_tokens: 0 },
        },
      }) +
      event('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }) +
      event('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'Die Steuerkette ' },
      }) +
      event('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: 'gehört in die Werkstatt.' },
      }) +
      event('content_block_stop', { type: 'content_block_stop', index: 0 }) +
      event('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 6 },
      }) +
      event('message_stop', { type: 'message_stop' }),
  })
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

// --- Bild mitschicken: landet es als inlineData im Google-Format? ---
// Ein 1x1-PNG genügt – geprüft wird die Übersetzung, nicht der Bildinhalt.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
lastGoogleBody = null
await page.setInputFiles('input[type="file"]', {
  name: 'motor.png',
  mimeType: 'image/png',
  buffer: PNG,
})
await page.waitForTimeout(600)
await page.getByPlaceholder('Frage stellen…').fill('Was ist das für ein Teil?')
await page.locator('form button[type="submit"], button[aria-label="Senden"]').first().click()
await page.waitForTimeout(1500)

const imagePart = lastGoogleBody?.contents?.at(-1)?.parts?.find((p) => p.inlineData)
if (!imagePart) {
  problems.push('[bild] Das Foto wurde nicht als inlineData übertragen')
} else if (imagePart.inlineData.mimeType !== 'image/png' || !imagePart.inlineData.data) {
  problems.push('[bild] inlineData ist unvollständig (mimeType oder Daten fehlen)')
}

// --- Strukturierte Antwort: der Weg für Fahrzeugschein, Beleg, Teilefinder, Steckbrief ---
// Zusätzlich wird ein abgeschaltetes Modell simuliert: Die App muss still auf ein
// gültiges wechseln, statt den Nutzer in die Einstellungen zu schicken.
structuredMode = 'unknown-model'
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('meraq-auto-ai'))
  raw.state.settings.googleModel = 'gemini-abgeschaltet'
  localStorage.setItem('meraq-auto-ai', JSON.stringify(raw))
})
await page.reload({ waitUntil: 'networkidle' })
await goto('#/lookup')
await page.getByPlaceholder('z. B. Volkswagen').fill('Volkswagen')
await page.getByPlaceholder('z. B. Passat').fill('Passat B8')
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Steckbrief erstellen' }).click()
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/steckbrief-google.png`, fullPage: false })

const lookup = await text()
if (!seen.structured) problems.push('[strukturiert] Es ging keine Anfrage an Google')
if (!lookup.includes('Steuerkette')) {
  problems.push('[strukturiert] Die strukturierte Antwort erscheint nicht im Steckbrief')
}
if (lastStructuredModel === 'gemini-abgeschaltet') {
  problems.push('[modellwechsel] Nach dem 404 wurde nicht auf ein gültiges Modell gewechselt')
}

// Die Anfrage muss im Google-Format sein: erzwungener Funktionsaufruf, bereinigtes Schema
const decl = lastStructuredBody?.tools?.[0]?.functionDeclarations?.[0]
if (!decl?.parameters?.properties) problems.push('[strukturiert] Das Schema fehlt in der Anfrage')
if (lastStructuredBody?.toolConfig?.functionCallingConfig?.mode !== 'ANY') {
  problems.push('[strukturiert] Der Funktionsaufruf wird nicht erzwungen (mode ANY)')
}
if (JSON.stringify(decl?.parameters ?? {}).includes('additionalProperties')) {
  problems.push('[strukturiert] Google-fremde Schema-Schlüssel wurden nicht entfernt')
}

// Das reparierte Modell muss gespeichert sein, sonst scheitert der nächste Aufruf wieder
const storedModel = await page.evaluate(
  () => JSON.parse(localStorage.getItem('meraq-auto-ai')).state.settings.googleModel,
)
if (storedModel === 'gemini-abgeschaltet') {
  problems.push('[modellwechsel] Das reparierte Modell wurde nicht gespeichert')
}

if (seen.anthropic) problems.push('[trennung] Anthropic wurde angefragt, obwohl Google eingestellt war')

// --- Anthropic: derselbe Weg, anderer Anbieter ---
// Der Umbau auf zwei Anbieter hat diesen Pfad angefasst – er muss weiter tragen,
// samt Prompt-Caching auf dem letzten System-Block.
await goto('#/settings')
await page.getByRole('button', { name: 'Anthropic · stärker' }).click()
await page.waitForTimeout(400)
await page.locator('input[type="password"]').fill('sk-ant-testschluessel')
await page.getByRole('button', { name: 'Speichern & prüfen' }).click()
await page.waitForTimeout(1500)

if (!(await text()).includes('Schlüssel funktioniert')) {
  problems.push('[anthropic] Die Schlüsselprüfung meldet keinen Erfolg')
}

await goto('#/assistant')
await page.getByPlaceholder('Frage stellen…').fill('Was ist mit der Steuerkette?')
await page.locator('form button[type="submit"], button[aria-label="Senden"]').first().click()
await page.waitForTimeout(2000)

const claudeChat = await text()
if (!claudeChat.includes('gehört in die Werkstatt')) {
  problems.push('[anthropic] Die gestreamte Antwort erscheint nicht im Verlauf')
}
if (!lastAnthropicBody?.system?.at(-1)?.cache_control) {
  problems.push('[anthropic] Prompt-Caching fehlt auf dem letzten System-Block')
}
if (!Array.isArray(lastAnthropicBody?.messages)) {
  problems.push('[anthropic] Die Nachrichten kommen nicht im Anthropic-Format an')
}
await page.screenshot({ path: `${OUT}/assistent-anthropic.png`, fullPage: false })

await browser.close()

if (problems.length) {
  console.log('PROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(
  `OK – Google: ${seen.models} Modellabfrage(n), ${seen.stream} Streaming, ${seen.structured} strukturiert, ` +
    `Bild und Modellwechsel. Anthropic: Streaming und Prompt-Caching. Anbieter sauber getrennt.`,
)
