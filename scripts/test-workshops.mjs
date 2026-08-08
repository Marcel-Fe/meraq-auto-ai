/**
 * Prüft die Werkstattsuche, ohne vom echten Kartendienst abzuhängen.
 *
 * Overpass ist ein kostenloses Gemeinschaftsangebot und weist etwa jede dritte
 * Anfrage ab – ein Test, der ihn wirklich aufruft, wäre unzuverlässig und würde
 * den Dienst unnötig belasten. Deshalb werden die Antworten abgefangen. Geprüft
 * wird damit alles, was in unserer Hand liegt: Abfrage, Wiederholversuch,
 * Fehlermeldung, Darstellung und die Fahrzeugabhängigkeit.
 *
 * Aufruf: node scripts/test-workshops.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173/meraq-auto-ai/'
const OUT = 'screenshots/werkstatt'
mkdirSync(OUT, { recursive: true })

const problems = []
const queries = []
let mode = 'ok'
let calls = 0

/** Zwei echte Betriebe und ein unbrauchbarer Eintrag ohne Namen */
const ELEMENTS = [
  {
    type: 'node',
    id: 1,
    lat: 52.3784,
    lon: 9.7355,
    tags: {
      name: 'Kfz-Meisterbetrieb Testmann',
      shop: 'car_repair',
      'addr:street': 'Teststraße',
      'addr:housenumber': '5',
      'addr:city': 'Hannover',
      'addr:postcode': '30159',
      phone: '+49 511 123456',
      opening_hours: 'Mo-Fr 08:00-17:00',
    },
  },
  {
    type: 'way',
    id: 2,
    center: { lat: 52.39, lon: 9.75 },
    tags: { name: 'Reifen Musterhaus', shop: 'tyres', website: 'https://example.org' },
  },
  { type: 'node', id: 3, lat: 52.4, lon: 9.76, tags: { shop: 'car_repair' } },
]

const browser = await chromium.launch()
const context = await browser.newContext({
  ...devices['iPhone 14'],
  locale: 'de-DE',
  geolocation: { latitude: 52.3759, longitude: 9.732 },
  permissions: ['geolocation'],
})

await context.route('**/overpass-api.de/api/interpreter', async (route) => {
  calls++
  queries.push(route.request().postData() ?? '')
  // "retry": der erste Versuch scheitert, der zweite gelingt – so wie im Alltag
  if (mode === 'fail' || (mode === 'retry' && calls === 1)) {
    await route.fulfill({ status: 504, contentType: 'text/html', body: '<html>overload</html>' })
    return
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ elements: ELEMENTS }),
  })
})

const page = await context.newPage()
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

const goto = async (hash) => {
  await page.evaluate((h) => (window.location.hash = h), hash)
  await page.waitForTimeout(700)
}
const text = () => page.evaluate(() => document.body.innerText)
const search = async (label) => {
  await page.getByRole('button', { name: label }).click()
  await page.waitForTimeout(2500)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
await page.waitForTimeout(400)

// --- Vor der Suche: Beispiele müssen als solche gekennzeichnet sein ---
await goto('#/workshops')
// Der Screen wird erst bei Bedarf geladen – auf ihn warten statt auf die Uhr,
// sonst prüft der Test eine noch leere Seite
await page.getByRole('button', { name: 'Werkstätten in der Nähe suchen' }).waitFor({ timeout: 15000 })
const before = await text()
if (!before.includes('Beispielbetriebe')) problems.push('[start] Beispieldaten sind nicht gekennzeichnet')
if (!/erfunden/.test(before)) problems.push('[start] Es steht nicht dabei, dass die Beispiele erfunden sind')

// --- Erfolgreiche Suche ---
await search('Werkstätten in der Nähe suchen')
await page.screenshot({ path: `${OUT}/treffer.png`, fullPage: true })
const found = await text()

if (!found.includes('Kfz-Meisterbetrieb Testmann')) problems.push('[suche] Treffer werden nicht angezeigt')
if (!found.includes('Reifen Musterhaus')) problems.push('[suche] Der Flächen-Eintrag (way/center) fehlt')
if (found.includes('Beispielbetriebe')) problems.push('[suche] Beispieldaten stehen neben echten Treffern')
if (!/Mo-Fr 08:00-17:00/.test(found)) problems.push('[suche] Öffnungszeiten fehlen')
if (!found.includes('OpenStreetMap-Mitwirkenden')) problems.push('[lizenz] ODbL-Namensnennung fehlt')

// Ehrlichkeit: Was OSM nicht kennt, darf nicht auftauchen
if (/\d,\d\s*\(\d+\)/.test(found)) problems.push('[ehrlichkeit] Bei echten Treffern erscheinen Bewertungen')
if (/€\/h/.test(found)) problems.push('[ehrlichkeit] Bei echten Treffern erscheint ein Stundensatz')

// Der Eintrag ohne Namen ist für Nutzer wertlos und muss herausfallen.
// Gezählt wird über den Kartenlink – den hat jede Trefferkarte genau einmal.
const cardCount = await page.locator('a[href*="openstreetmap.org/?mlat"]').count()
if (cardCount !== 2) {
  problems.push(`[suche] Erwartet waren 2 Treffer (der dritte hat keinen Namen), gezeigt werden ${cardCount}`)
}

// --- Abfrage prüfen: eine einzige Umkreissuche, passend zum Pkw ---
const q = queries[0] ?? ''
if ((q.match(/around:/g) ?? []).length !== 1) {
  problems.push(`[abfrage] Es sollte genau eine Umkreissuche sein: ${q.slice(0, 120)}`)
}
if (!q.includes('car_repair') || !q.includes('tyres')) problems.push('[abfrage] Pkw-Betriebe fehlen in der Abfrage')
if (q.includes('motorcycle')) problems.push('[abfrage] Motorradwerkstätten bei einem Pkw gesucht')

// --- Wiederholversuch nach Überlastung ---
mode = 'retry'
calls = 0
await search('Erneut suchen')
if (calls < 2) problems.push('[wiederholung] Nach einer Überlastmeldung wurde nicht erneut versucht')
if (!(await text()).includes('Kfz-Meisterbetrieb Testmann')) {
  problems.push('[wiederholung] Der zweite Versuch führte nicht zum Ergebnis')
}

// --- Dauerhafter Ausfall: verständliche Meldung, keine leere Seite ---
mode = 'fail'
await search('Erneut suchen')
const failed = await text()
if (!/überlastet|antwortet gerade nicht/i.test(failed)) {
  problems.push('[ausfall] Keine verständliche Meldung bei dauerhafter Überlastung')
}
if (!failed.includes('Kfz-Meisterbetrieb Testmann')) {
  problems.push('[ausfall] Das zuletzt gefundene Ergebnis ging verloren')
}
await page.screenshot({ path: `${OUT}/ausfall.png`, fullPage: false })

// --- Fahrzeugabhängigkeit: Motorrad sucht Motorradwerkstätten ---
mode = 'ok'
await goto('#/vehicle/new')
await page.getByRole('button', { name: 'Motorrad', exact: true }).click()
await page.getByPlaceholder('z. B. Volkswagen').fill('Honda')
await page.getByPlaceholder('z. B. Golf').fill('CB 650 R')
const n = page.locator('input[type="number"]')
await n.nth(0).fill('2021')
await n.nth(1).fill('18000')
await n.nth(2).fill('70')
await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()
await page.waitForTimeout(900)

await goto('#/workshops')
queries.length = 0
await search('Erneut suchen')
const motoQuery = queries[0] ?? ''
if (!motoQuery.includes('motorcycle_repair')) {
  problems.push('[fahrzeug] Für ein Motorrad wurden keine Motorradwerkstätten gesucht')
}
if (motoQuery.includes('car_repair')) {
  problems.push('[fahrzeug] Einem Motorrad werden Pkw-Werkstätten vorgeschlagen')
}
if (!(await text()).includes('Motorradwerkstatt')) {
  problems.push('[fahrzeug] Der Hinweis auf die gesuchte Betriebsart passt nicht zum Motorrad')
}
await page.screenshot({ path: `${OUT}/motorrad.png`, fullPage: false })

await browser.close()

if (problems.length) {
  console.log('PROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('OK – Werkstattsuche geprüft: Treffer, Wiederholversuch, Ausfall und Fahrzeugabhängigkeit.')
