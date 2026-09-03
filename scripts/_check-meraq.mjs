import { chromium } from 'playwright'
const PROFILE = process.argv[2]
const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'msedge', headless: false, viewport: { width: 430, height: 860 }, locale: 'de-DE',
  args: ['--no-first-run', '--no-default-browser-check'],
})
const page = ctx.pages()[0] ?? (await ctx.newPage())
const errs = []
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)))
await page.goto('https://marcel-fe.github.io/meraq-auto-ai/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
// Der Service Worker haelt den alten Stand fest – einmal wegraeumen und neu laden
const sw = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  for (const r of regs) await r.unregister()
  for (const k of await caches.keys()) await caches.delete(k)
  return regs.length
})
console.log('Service Worker entfernt:', sw)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.evaluate(() => (window.location.hash = '#/assistant'))
await page.waitForTimeout(1000)

// Frische Unterhaltung, damit der abgebrochene Versuch nicht mitzaehlt
const neu = page.getByRole('button', { name: 'Neue Unterhaltung' })
if (await neu.count()) { await neu.click(); await page.waitForTimeout(600) }

const box = page.getByPlaceholder('Frage stellen…')
await box.fill('Antworte in genau einem Satz: Warum sollte ich den Ölstand regelmäßig prüfen?')
await page.getByRole('button', { name: 'Senden' }).click()

// Geduldig: bis zu 90 s auf den ersten Buchstaben der Antwort warten
const start = Date.now()
let antwort = ''
while (Date.now() - start < 90000) {
  antwort = await page.evaluate(() => {
    const blasen = [...document.querySelectorAll('main *, body *')]
    return document.body.innerText
  })
  // Die Antwort steht nach der Frage – erkennbar an zusaetzlichem Text
  const nachFrage = antwort.split('Ölstand regelmäßig prüfen?').pop() ?? ''
  if (nachFrage.replace(/Frage stellen|Home|Fahrzeug|KI|Dokumente|Mehr/g, '').trim().length > 40) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(4000)
const text = await page.evaluate(() => document.body.innerText)
const nachFrage = (text.split('Ölstand regelmäßig prüfen?').pop() ?? '')
  .replace(/Frage stellen…|Home|Fahrzeug|KI|Dokumente|Mehr/g, '').trim()
console.log('--- Antwort der KI ---')
console.log(nachFrage.slice(0, 400) || '(leer)')
console.log('----------------------')
console.log('Dauer:', Math.round((Date.now() - start) / 1000), 's')
if (errs.length) console.log('Seitenfehler:', errs)
await page.screenshot({ path: 'screenshots/einrichtung/3-antwort.png', fullPage: true })
await ctx.close()
process.exit(nachFrage.length > 40 && !/Fehler|abgelehnt|überlastet/i.test(nachFrage) ? 0 : 1)
