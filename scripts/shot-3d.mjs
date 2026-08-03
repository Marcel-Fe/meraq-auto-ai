/**
 * Nimmt die 3D-Ansicht des Bauteil-Explorers für alle drei Bauformen auf –
 * Pkw, Transporter und Motorrad, je Zone und zusätzlich einmal gedreht.
 *
 * Eine Zahl beweist keine Form: Die Bilder aus screenshots/3d/ müssen angesehen
 * werden. Der Preview-Server läuft nur für die Dauer des Skripts (als
 * Hintergrund-Task stirbt er in dieser Umgebung).
 *
 * Aufruf: node scripts/shot-3d.mjs
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { startPreview } from './preview-server.mjs'

const OUT = 'screenshots/3d'
mkdirSync(OUT, { recursive: true })

const CASES = [
  { slug: 'pkw', neu: null },
  {
    slug: 'transporter',
    neu: {
      kindLabel: 'Transporter',
      make: 'Mercedes-Benz',
      model: 'Sprinter 316 CDI',
      year: '2020',
      mileage: '145000',
      powerKw: '120',
      fuel: 'Diesel',
      transmission: 'Schaltgetriebe',
    },
  },
  {
    slug: 'motorrad',
    neu: {
      kindLabel: 'Motorrad',
      make: 'Honda',
      model: 'CB 650 R',
      year: '2021',
      mileage: '18000',
      powerKw: '70',
      fuel: 'Benzin',
      transmission: 'Schaltgetriebe',
    },
  },
]

const problems = []
const preview = await startPreview(4173)

try {
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' })
  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

  await page.goto(preview.base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
  await page.waitForTimeout(400)

  const goto = async (hash) => {
    await page.evaluate((h) => (window.location.hash = h), hash)
    await page.waitForTimeout(700)
  }

  for (const c of CASES) {
    if (c.neu) {
      await goto('#/vehicle/new')
      await page.getByRole('button', { name: c.neu.kindLabel, exact: true }).click()
      await page.waitForTimeout(200)
      await page.getByPlaceholder('z. B. Volkswagen').fill(c.neu.make)
      await page.getByPlaceholder('z. B. Golf').fill(c.neu.model)
      const numbers = page.locator('input[type="number"]')
      await numbers.nth(0).fill(c.neu.year)
      await numbers.nth(1).fill(c.neu.mileage)
      await numbers.nth(2).fill(c.neu.powerKw)
      await page.locator('select').nth(0).selectOption(c.neu.fuel)
      await page.locator('select').nth(1).selectOption(c.neu.transmission)
      await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()
      await page.waitForTimeout(900)
    }

    await goto('#/manual')
    await page.waitForTimeout(1200) // Three.js wird erst hier nachgeladen

    const canvas = page.locator('canvas')
    if ((await canvas.count()) === 0) {
      problems.push(`[${c.slug}] kein WebGL-Canvas – die 3D-Ansicht wurde nicht gerendert`)
      await page.screenshot({ path: `${OUT}/${c.slug}-ohne-canvas.png` })
      continue
    }

    const zones = page.locator('div.overflow-x-auto > button')
    const labels = await zones.allInnerTexts()

    for (const [index, label] of labels.entries()) {
      await zones.nth(index).click()
      await page.waitForTimeout(1200)
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

      await canvas.screenshot({ path: `${OUT}/${c.slug}-${slug}.png` })

      // Einmal drehen: die Form muss auch von schräg hinten stimmen
      const box = await canvas.boundingBox()
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.42, { steps: 12 })
      await page.mouse.up()
      await page.waitForTimeout(800)
      await canvas.screenshot({ path: `${OUT}/${c.slug}-${slug}-gedreht.png` })
    }

    // Ganze Seite als Kontext – Marker liegen als HTML über dem Bild
    await page.screenshot({ path: `${OUT}/${c.slug}-seite.png` })
    console.log(`✓ ${c.slug}: ${labels.length} Zonen aufgenommen (${labels.join(', ')})`)
  }

  await browser.close()
} finally {
  preview.stop()
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`\nOK – Bilder liegen in ${OUT}/ und müssen angesehen werden.`)
