/**
 * Der ganze Weg „Frage sprechen" über die echte Oberfläche.
 *
 * Zwei Wege, beide geprüft:
 *  1. Diktat über die Spracherkennung des Geräts. Die Attrappe bildet das
 *     **Format der echten Schnittstelle** nach – eine `results`-Liste mit
 *     `resultIndex`, `isFinal` und `[0].transcript` – und nicht das erwartete
 *     Ergebnis (siehe lessons.md).
 *  2. Aufnahme über ein echtes Fake-Mikrofon von Chromium, umgerechnet und an
 *     die KI geschickt. Der abgefangene Aufruf wird darauf geprüft, dass
 *     wirklich `audio/wav` ankommt: Der Browser nimmt in webm bzw. mp4 auf,
 *     und beides nimmt Google nicht an.
 *
 * Abgeschickt werden darf nichts von allein – auch das wird geprüft.
 *
 * Aufruf: node scripts/test-voice-input.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173/meraq-auto-ai/'
const OUT = 'screenshots/sprache'
mkdirSync(OUT, { recursive: true })

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

let transcribeCalls = 0
let lastAudioMime = null
let lastAudioBytes = 0
let lastSystem = ''

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const context = await browser.newContext({
  ...devices['iPhone 14'],
  locale: 'de-DE',
  permissions: ['microphone'],
})

// --- Die Spracherkennung des Geräts nachbilden, im Format der echten ---
await context.addInitScript(() => {
  class FakeRecognition {
    constructor() {
      this.lang = ''
      this.continuous = false
      this.interimResults = false
      this.maxAlternatives = 1
      this.onresult = null
      this.onerror = null
      this.onend = null
    }
    start() {
      window.__speech = this
      window.__speechStarts = (window.__speechStarts ?? 0) + 1
    }
    stop() {
      this.onend?.()
    }
    abort() {
      this.onend?.()
    }
  }
  window.SpeechRecognition = FakeRecognition
  window.webkitSpeechRecognition = FakeRecognition

  // So schickt die echte Schnittstelle ihre Ergebnisse: eine Liste mit
  // Startindex, je Eintrag isFinal und die beste Alternative unter [0]
  window.__say = (transcript, isFinal) => {
    const recognition = window.__speech
    if (!recognition?.onresult) return false
    const result = { isFinal, length: 1, 0: { transcript, confidence: 0.9 } }
    recognition.onresult({ resultIndex: 0, results: { length: 1, 0: result } })
    return true
  }
  window.__speechFail = (error) => window.__speech?.onerror?.({ error })
})

// --- Google: Modell-Liste für die Schlüsselprüfung ---
await context.route('**/generativelanguage.googleapis.com/**/models?*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      models: [
        {
          name: 'models/gemini-flash-latest',
          displayName: 'Gemini Flash',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    }),
  })
})

// --- Google: die Transkription der Aufnahme ---
await context.route('**/generativelanguage.googleapis.com/**:generateContent*', async (route) => {
  const body = JSON.parse(route.request().postData() ?? '{}')
  const audio = body?.contents?.[0]?.parts?.find((p) => p.inlineData)?.inlineData

  if (!audio) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"candidates":[]}' })
    return
  }

  transcribeCalls++
  lastAudioMime = audio.mimeType
  lastAudioBytes = Buffer.from(audio.data, 'base64').length
  lastSystem = body?.systemInstruction?.parts?.[0]?.text ?? ''

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      candidates: [
        { content: { parts: [{ text: 'Wann ist der Zahnriemen bei meinem Auto fällig?' }] } },
      ],
    }),
  })
})

const page = await context.newPage()
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

const goto = async (hash) => {
  await page.evaluate((h) => (window.location.hash = h), hash)
  await page.waitForTimeout(700)
}
const field = () => page.locator('textarea')
const micIdle = () => page.getByRole('button', { name: 'Frage sprechen' })

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
await page.waitForTimeout(400)

console.log('Ohne Schlüssel bleibt das Mikrofon stumm')
{
  await goto('#/assistant')
  check('Mikrofon-Knopf ist da', (await micIdle().count()) === 1)
  check('und ohne Schlüssel nicht bedienbar', await micIdle().isDisabled())
  await page.screenshot({ path: `${OUT}/ohne-schluessel.png` })
}

// --- Schlüssel eintragen, damit auch der Aufnahme-Weg möglich ist ---
await goto('#/settings')
await page.locator('input[type="password"]').first().fill('AIzaTestSchluessel')
await page.getByRole('button', { name: /prüfen|speichern/i }).first().click()
await page.waitForTimeout(900)

console.log('\nWeg 1: Diktat über das Gerät')
{
  await goto('#/assistant')
  check('mit Schlüssel ist das Mikrofon bedienbar', !(await micIdle().isDisabled()))

  await micIdle().click()
  await page.waitForTimeout(400)

  const started = await page.evaluate(() => window.__speechStarts ?? 0)
  check('die Spracherkennung wurde gestartet', started === 1, `${started}`)

  const lang = await page.evaluate(() => window.__speech?.lang)
  check('sie hört auf Deutsch', lang === 'de-DE', `${lang}`)
  const interim = await page.evaluate(() => window.__speech?.interimResults)
  check('Zwischenstand ist eingeschaltet', interim === true)

  await page.evaluate(() => window.__say('Wann ist der Zahnriemen', false))
  await page.waitForTimeout(250)
  const zwischenstand = await page.evaluate(() => document.body.innerText)
  check('der Zwischenstand ist zu sehen', zwischenstand.includes('Wann ist der Zahnriemen'))
  check('er steht aber noch nicht im Eingabefeld', (await field().inputValue()) === '')
  await page.screenshot({ path: `${OUT}/diktat-laeuft.png` })

  await page.evaluate(() => window.__say('Wann ist der Zahnriemen fällig?', true))
  await page.waitForTimeout(300)
  check(
    'der fertige Satz landet im Eingabefeld',
    (await field().inputValue()) === 'Wann ist der Zahnriemen fällig?',
    await field().inputValue(),
  )

  // Zweiter Abschnitt nach einer Sprechpause – er darf den ersten nicht löschen
  await page.evaluate(() => window.__say('Und was kostet das?', true))
  await page.waitForTimeout(300)
  check(
    'weiter gesprochenes wird angehängt, nicht ersetzt',
    (await field().inputValue()) === 'Wann ist der Zahnriemen fällig? Und was kostet das?',
    await field().inputValue(),
  )

  const gesendet = await page.evaluate(() => document.body.innerText)
  check('nichts wurde von allein abgeschickt', !gesendet.includes('Der Bremsbelag'))
  check('keine Transkription über die KI nötig', transcribeCalls === 0, `${transcribeCalls}`)

  await page.getByRole('button', { name: 'Zuhören beenden' }).click()
  await page.waitForTimeout(300)
  check('nach dem Beenden ist der Knopf wieder im Ruhezustand', (await micIdle().count()) === 1)
  await page.screenshot({ path: `${OUT}/diktat-fertig.png` })

  await field().fill('')
}

console.log('\nWeg 2: Aufnehmen und von der KI mitschreiben lassen')
{
  // Gerät ohne eigene Spracherkennung – so verhält sich Firefox, und so
  // verhalten sich manche installierten Web-Apps auf dem iPhone
  await page.evaluate(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })
  // Neu zeichnen lassen, damit die Fähigkeit erneut geprüft wird
  await field().fill('x')
  await field().fill('')
  await page.waitForTimeout(200)

  await micIdle().click()
  await page.waitForTimeout(1500)

  const stopper = page.getByRole('button', { name: 'Aufnahme beenden' })
  check('die Aufnahme läuft', (await stopper.count()) === 1)
  const laeuft = await page.evaluate(() => document.body.innerText)
  check('das sieht man auch', laeuft.includes('Aufnahme läuft'))
  await page.screenshot({ path: `${OUT}/aufnahme-laeuft.png` })

  await stopper.click()
  await page.waitForTimeout(2500)

  check('die KI wurde genau einmal gefragt', transcribeCalls === 1, `${transcribeCalls}`)
  check('und bekam WAV, nicht das Roh-Format des Browsers', lastAudioMime === 'audio/wav', `${lastAudioMime}`)
  check('die Aufnahme war nicht leer', lastAudioBytes > 10_000, `${lastAudioBytes} Byte`)
  check(
    'der System-Prompt verbietet das Beantworten',
    /Antworte nicht auf die Frage/.test(lastSystem),
    lastSystem.slice(0, 60),
  )
  check(
    'der Fahrzeugkontext geht mit',
    /Der Nutzer fährt einen/.test(lastSystem),
    lastSystem.slice(-120),
  )
  check(
    'der mitgeschriebene Text steht im Eingabefeld',
    (await field().inputValue()) === 'Wann ist der Zahnriemen bei meinem Auto fällig?',
    await field().inputValue(),
  )
  const nachher = await page.evaluate(() => document.body.innerText)
  check('auch hier wurde nichts von allein abgeschickt', !nachher.includes('Der Bremsbelag'))
  await page.screenshot({ path: `${OUT}/aufnahme-uebernommen.png` })
}

await browser.close()

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`\nOK – Diktat und Aufnahme führen beide zum Text im Feld. Screenshots in ${OUT}/`)
