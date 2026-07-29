// Prüft die Installierbarkeit: Service Worker, Manifest, Icons, Vollbild-Modus.
import { chromium, devices } from 'playwright'
const browser = await chromium.launch()
const page = await (await browser.newContext({ ...devices['iPhone 14'] })).newPage()
await page.goto('https://marcel-fe.github.io/meraq-auto-ai/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const r = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href')
  const manifest = href ? await (await fetch(href)).json() : null
  return {
    serviceWorker: regs.length > 0,
    manifestGefunden: !!manifest,
    name: manifest?.name,
    display: manifest?.display,
    startUrl: manifest?.start_url,
    themeColor: manifest?.theme_color,
    icons: manifest?.icons?.map((i) => `${i.sizes} ${i.purpose ?? 'any'}`),
    appleTouchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
  }
})
console.log(JSON.stringify(r, null, 2))
await browser.close()
