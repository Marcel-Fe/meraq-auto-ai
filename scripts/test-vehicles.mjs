/**
 * Legt über die Oberfläche verschiedene Fahrzeugtypen an und prüft, dass die App
 * sich jeweils richtig verhält: einem E-Auto darf kein Ölwechsel angeboten werden,
 * einem Diesel keine Zündkerzen, einem Motorrad keine Scheibenwischer.
 *
 * Aufruf: node scripts/test-vehicles.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173/meraq-auto-ai/'
const OUT = 'screenshots/fahrzeuge'
mkdirSync(OUT, { recursive: true })

const CASES = [
  {
    slug: 'e-auto',
    kindLabel: 'Auto',
    form: { make: 'Tesla', model: 'Model 3', year: '2022', mileage: '48000', powerKw: '208' },
    fuel: 'Elektro',
    transmission: 'Automatik',
    erwartet: {
      wartung: { fehlt: ['Ölwechsel', 'Zündkerzen', 'Luftfilter'], enthalten: ['Hochvoltbatterie', 'Bremsflüssigkeit'] },
      teile: { fehlt: ['Ölfilter', 'Zündkerze', 'Motoröl'], enthalten: ['Bremsbeläge', 'Hochvoltbatterie'] },
      anleitungen: { fehlt: ['Ölwechsel', 'Zündkerzen'], enthalten: ['Bremsbeläge'] },
      reparatur: { fehlt: ['Ölservice', 'Zündkerzen wechseln'], enthalten: ['Hochvoltbatterie prüfen'] },
    },
  },
  {
    slug: 'motorrad',
    kindLabel: 'Motorrad',
    form: { make: 'Honda', model: 'CB 650 R', year: '2021', mileage: '18000', powerKw: '70' },
    fuel: 'Benzin',
    transmission: 'Schaltgetriebe',
    erwartet: {
      wartung: { fehlt: ['Klimaservice', 'Innenraumfilter'], enthalten: ['Antriebskette', 'Ventilspiel', 'Ölwechsel'] },
      teile: { fehlt: ['Scheibenwischer', 'Innenraumfilter'], enthalten: ['Kettenkit', 'Zündkerze'] },
      anleitungen: { fehlt: ['Scheibenwischer', 'Innenraumfilter'], enthalten: ['Antriebskette'] },
      reparatur: { fehlt: ['Klimaservice', 'Achsvermessung'], enthalten: ['Kettenkit erneuern', 'Ventilspiel'] },
    },
  },
  {
    slug: 'diesel-transporter',
    kindLabel: 'Transporter',
    form: { make: 'Mercedes-Benz', model: 'Sprinter 316 CDI', year: '2020', mileage: '145000', powerKw: '120' },
    fuel: 'Diesel',
    transmission: 'Schaltgetriebe',
    erwartet: {
      wartung: { fehlt: ['Zündkerzen'], enthalten: ['Glühkerzen', 'Partikelfilter', 'Ölwechsel'] },
      teile: { fehlt: ['Zündkerze'], enthalten: ['Glühkerze', 'AGR-Ventil', 'Partikelfilter'] },
      anleitungen: { fehlt: ['Zündkerzen wechseln'], enthalten: ['Ölwechsel'] },
      reparatur: { fehlt: ['Zündkerzen wechseln'], enthalten: ['Glühkerzen wechseln', 'AGR-Ventil ersetzen'] },
    },
  },
]

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' })
const page = await context.newPage()

const problems = []
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
await page.waitForTimeout(400)

const goto = async (hash) => {
  await page.evaluate((h) => (window.location.hash = h), hash)
  await page.waitForTimeout(700)
}
const text = () => page.evaluate(() => document.body.innerText)

for (const c of CASES) {
  // --- Fahrzeug über das Formular anlegen ---
  await goto('#/vehicle/new')
  await page.getByRole('button', { name: c.kindLabel, exact: true }).click()
  await page.waitForTimeout(200)

  await page.getByPlaceholder('z. B. Volkswagen').fill(c.form.make)
  await page.getByPlaceholder('z. B. Golf').fill(c.form.model)

  const numbers = page.locator('input[type="number"]')
  await numbers.nth(0).fill(c.form.year) // Baujahr
  await numbers.nth(1).fill(c.form.mileage) // Kilometerstand
  await numbers.nth(2).fill(c.form.powerKw) // Leistung

  await page.locator('select').nth(0).selectOption(c.fuel)
  await page.locator('select').nth(1).selectOption(c.transmission)

  await page.screenshot({ path: `${OUT}/${c.slug}-formular.png` })
  await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()
  await page.waitForTimeout(900)

  const aktiv = await text()
  if (!aktiv.includes(c.form.model)) {
    problems.push(`[${c.slug}] Fahrzeug wurde nicht angelegt oder ist nicht aktiv`)
    continue
  }

  // --- Screens prüfen ---
  const screens = [
    ['wartung', '#/maintenance'],
    ['teile', '#/parts'],
    ['anleitungen', '#/guides'],
    ['reparatur', '#/repair-costs'],
  ]

  for (const [key, hash] of screens) {
    await goto(hash)
    // Filter auf "Alle" lassen, aber alle Kategorien einbeziehen: Seite komplett auslesen
    const inhalt = await page.evaluate(() => document.body.innerText)
    await page.screenshot({ path: `${OUT}/${c.slug}-${key}.png` })

    const regeln = c.erwartet[key]
    for (const begriff of regeln.fehlt) {
      if (inhalt.includes(begriff)) {
        problems.push(`[${c.slug}/${key}] "${begriff}" wird angezeigt, darf es aber nicht`)
      }
    }
    for (const begriff of regeln.enthalten) {
      if (!inhalt.includes(begriff)) {
        problems.push(`[${c.slug}/${key}] "${begriff}" fehlt`)
      }
    }
  }

  // --- Marktwert muss eine plausible Zahl liefern ---
  await goto('#/value')
  const wert = await text()
  const match = wert.match(/([\d.]+)\s*€/)
  const zahl = match ? Number(match[1].replace(/\./g, '')) : 0
  if (zahl < 300) problems.push(`[${c.slug}/marktwert] unplausibler Wert: ${match?.[0] ?? 'keiner gefunden'}`)
  await page.screenshot({ path: `${OUT}/${c.slug}-marktwert.png` })

  // --- Handbuch muss Zonen zeigen ---
  await goto('#/manual')
  const handbuch = await text()
  if (!/\d+ Bauteile/.test(handbuch)) problems.push(`[${c.slug}/handbuch] keine Bauteile gefunden`)
  await page.screenshot({ path: `${OUT}/${c.slug}-handbuch.png` })

  console.log(`✓ ${c.slug}: ${c.form.make} ${c.form.model} geprüft`)
}

// --- Vergleich: drei sehr unterschiedliche Fahrzeuge nebeneinander ---
// Hier stehen jetzt Demo-Fahrzeug, E-Auto, Motorrad und Diesel-Transporter zur Wahl.
await goto('#/compare')
await page.getByRole('button', { name: 'Tesla Model 3' }).click()
await page.waitForTimeout(500)

const vergleich = await text()
for (const begriff of ['Kosten pro Monat', 'Wertverlust pro Jahr', 'Marktwert heute']) {
  if (!vergleich.includes(begriff)) problems.push(`[vergleich] "${begriff}" fehlt`)
}
// Elektro gegen Verbrenner: Beschriftung und Einheitenhinweis müssen mitwandern
if (!vergleich.includes('Kraftstoff bzw. Strom')) {
  problems.push('[vergleich] Beschriftung passt nicht zum Mix aus Elektro und Verbrenner')
}
if (!vergleich.includes('unterschiedliche Einheiten')) {
  problems.push('[vergleich] Hinweis auf unterschiedliche Einheiten (l bzw. kWh) fehlt')
}
const breite = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}))
if (breite.scrollW > breite.clientW + 1) {
  problems.push(`[vergleich] horizontales Scrollen bei drei Spalten: ${breite.scrollW} > ${breite.clientW}`)
}
await page.screenshot({ path: `${OUT}/vergleich-drei-fahrzeuge.png` })
console.log('✓ vergleich: drei Fahrzeuge nebeneinander geprüft')

await browser.close()

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`\nOK – ${CASES.length} Fahrzeugtypen verhalten sich korrekt. Screenshots in ${OUT}/`)
