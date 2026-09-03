import { chromium } from 'playwright'
const ctx = await chromium.launchPersistentContext(process.argv[2], {
  channel: 'msedge', headless: false, viewport: { width: 430, height: 900 }, locale: 'de-DE',
  args: ['--no-first-run', '--no-default-browser-check'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
await page.goto('https://marcel-fe.github.io/meraq-auto-ai/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.evaluate(() => (window.location.hash = '#/invoice'))
await page.waitForTimeout(1000)
await page.setInputFiles('input[aria-label="Rechnungsbild wählen"]', 'screenshots/einrichtung/testbeleg.png')

const start = Date.now()
while (Date.now() - start < 120000) {
  const t = await page.evaluate(() => document.body.innerText)
  if (/Position für Position|nicht lesbar|Schlüssel|Fehler|abgelehnt/i.test(t)) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(2500)
const t = await page.evaluate(() => document.body.innerText)
console.log('Dauer:', Math.round((Date.now() - start) / 1000), 's')
console.log('--- Was die App zeigt ---')
console.log(t.slice(0, 2600))
await page.screenshot({ path: 'screenshots/einrichtung/4-echte-rechnung.png', fullPage: true })
if (errs.length) console.log('Seitenfehler:', errs)
await ctx.close()
