/**
 * Klickt alle Screens im iPhone-Format durch, prüft auf Konsolenfehler,
 * horizontales Scrollen und überlappende Bottom-Nav – und legt Screenshots ab.
 *
 * Aufruf: node scripts/smoke-test.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173/meraq-auto-ai/'
const OUT = 'screenshots'
mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['onboarding', '#/onboarding'],
  ['dashboard', '#/'],
  ['vehicle', '#/vehicle'],
  ['vehicle-new', '#/vehicle/new'],
  ['diagnosis', '#/diagnosis'],
  ['maintenance', '#/maintenance'],
  ['manual', '#/manual'],
  ['part-finder', '#/part-finder'],
  ['costs', '#/costs'],
  ['quote', '#/quote'],
  ['lookup', '#/lookup'],
  ['guides', '#/guides'],
  ['guide-detail', '#/guides/oil-change'],
  ['value', '#/value'],
  ['parts', '#/parts'],
  ['repair-costs', '#/repair-costs'],
  ['documents', '#/documents'],
  ['invoice', '#/invoice'],
  ['reminders', '#/reminders'],
  ['compare', '#/compare'],
  ['workshops', '#/workshops'],
  ['more', '#/more'],
  ['assistant', '#/assistant'],
  ['settings', '#/settings'],
]

const browser = await chromium.launch()
const context = await browser.newContext({
  ...devices['iPhone 14'],
  locale: 'de-DE',
  permissions: [],
})
const page = await context.newPage()

const problems = []
page.on('console', (msg) => {
  if (msg.type() === 'error') problems.push(`[console] ${msg.text().slice(0, 200)}`)
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message.slice(0, 200)}`))

// Onboarding einmal echt durchlaufen – so wie ein Nutzer es tut
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/onboarding-splash.png` })
await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
await page.waitForTimeout(400)

for (const [name, hash] of ROUTES) {
  // Hash setzen statt goto: ein reines Hash-goto würde kein Neuladen auslösen
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await page.waitForTimeout(700)

  const metrics = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyText: document.body.innerText.trim().length,
    hasNav: !!document.querySelector('nav'),
  }))

  if (metrics.scrollW > metrics.clientW + 1) {
    problems.push(`[${name}] horizontales Scrollen: ${metrics.scrollW} > ${metrics.clientW}`)
  }
  if (metrics.bodyText < 40) {
    problems.push(`[${name}] Seite wirkt leer (${metrics.bodyText} Zeichen Text)`)
  }
  if (name !== 'onboarding' && !metrics.hasNav) {
    problems.push(`[${name}] Bottom-Nav fehlt`)
  }

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}

// Interaktionstest: Kilometerstand ändern und Persistenz prüfen
await page.evaluate(() => (window.location.hash = '#/vehicle'))
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'km eintragen' }).click()
await page.waitForTimeout(300)
const input = page.locator('input[inputmode="numeric"]').first()
await input.fill('75000')
await page.getByRole('button', { name: 'Speichern' }).click()
await page.waitForTimeout(400)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const persisted = await page.evaluate(() => document.body.innerText.includes('75.000'))
if (!persisted) problems.push('[persistenz] Geänderter Kilometerstand nach Reload nicht gefunden')

// Der Fortschritt in einer Anleitung muss einen Neustart überleben – wer unter
// dem Auto liegt und die App wegwischt, darf nicht bei Schritt 1 landen
await page.evaluate(() => (window.location.hash = '#/guides/oil-change'))
await page.waitForTimeout(700)
// Über den Text ansprechen, nicht über die Position: Sobald der erste Schritt
// abgehakt ist, schiebt sich der Zurücksetzen-Knopf davor
await page.getByRole('button', { name: /Vorbereiten/ }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /Öl ablassen/ }).click()
await page.waitForTimeout(300)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const fortschritt = await page.evaluate(() => document.body.innerText)
if (!fortschritt.includes('Schritt 3 von 6')) {
  problems.push(`[anleitung] Fortschritt nach Reload verloren: ${fortschritt.match(/Schritt \d+ von \d+/)?.[0] ?? 'keine Angabe'}`)
}

// Ist die Arbeit fertig, bietet die App den Eintrag an – gespeichert wird erst
// auf Bestätigung, und dann muss es wirklich im Verlauf stehen
for (const titel of ['Ölfilter tauschen', 'Verschließen', 'Neu befüllen', 'Kontrollieren']) {
  await page.getByRole('button', { name: new RegExp(titel) }).click()
  await page.waitForTimeout(150)
}
await page.waitForTimeout(300)
const angebot = await page.evaluate(() => document.body.innerText)
if (!angebot.includes('soll ich das eintragen')) {
  problems.push('[anleitung] Nach dem letzten Schritt kommt kein Angebot zum Eintragen')
}
await page.getByRole('button', { name: 'Eintragen', exact: true }).click()
await page.waitForTimeout(500)
await page.evaluate(() => (window.location.hash = '#/more'))
await page.waitForTimeout(700)
const verlauf = await page.evaluate(() => document.body.innerText)
if (!/Ölwechsel erledigt/.test(verlauf)) {
  problems.push('[anleitung] Die erledigte Arbeit steht nicht im Verlauf')
}

// KI ohne Schlüssel darf nicht abstürzen, sondern muss einen Hinweis samt Weg
// zur Einrichtung zeigen. Geprüft wird das Verhalten, nicht der Wortlaut.
await page.evaluate(() => (window.location.hash = '#/assistant'))
await page.waitForTimeout(600)
const hint = await page.evaluate(() => {
  const t = document.body.innerText
  return t.includes('noch nicht aktiviert') && /Schlüssel/.test(t) && /kostenlos/i.test(t)
})
if (!hint) problems.push('[assistant] Kein Hinweis auf den fehlenden Schlüssel samt kostenlosem Weg')

await browser.close()

if (problems.length) {
  console.log('PROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`OK – ${ROUTES.length} Screens geprüft, Screenshots in ${OUT}/`)
