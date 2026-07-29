// Prüft, ob api.anthropic.com den Direktaufruf aus dem Browser zulässt (CORS).
// Mit einem absichtlich ungültigen Schlüssel: Antwort 401 = CORS erlaubt, der Weg funktioniert.
import { chromium, devices } from 'playwright'
const browser = await chromium.launch()
const page = await (await browser.newContext({ ...devices['iPhone 14'] })).newPage()
await page.goto('https://marcel-fe.github.io/meraq-auto-ai/', { waitUntil: 'networkidle' })

const result = await page.evaluate(async () => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'sk-ant-invalid-key-for-cors-check',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 4, messages: [{ role: 'user', content: 'hi' }] }),
    })
    return { ok: true, status: res.status, body: (await res.text()).slice(0, 160) }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) }
  }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
