/**
 * Prüft die freie Bauteil-Suche im Handbuch – mit abgefangener KI-Antwort,
 * also ohne Guthabenverbrauch.
 *
 * Geprüft wird das, was der Nutzer sieht: dass die Suche über alle Zonen findet,
 * dass ein unbekanntes Bauteil trotzdem erklärt wird, dass der Kostenrahmen aus
 * dem eingestellten Stundensatz gerechnet ist – und dass die App ehrlich sagt,
 * wenn es das Bauteil an diesem Fahrzeug gar nicht gibt.
 *
 * Aufruf: npm run test:partsearch
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { ensurePreview } from './preview-server.mjs'

const OUT = 'screenshots/bauteilsuche'
mkdirSync(OUT, { recursive: true })

const problems = []
let asked = []

const ANSWERS = {
  radlager: {
    name: 'Radlager',
    exists: true,
    fn: 'Das Radlager führt das Rad und lässt es leichtgängig drehen. Es trägt das Gewicht des Fahrzeugs und nimmt die Kräfte beim Lenken und Bremsen auf.',
    location: 'In der Radnabe, hinter der Bremsscheibe – an jedem der vier Räder.',
    symptoms: ['Brummen, das mit der Geschwindigkeit steigt', 'Geräusch ändert sich in Kurven', 'Spiel am angehobenen Rad'],
    checks: ['Rad am aufgebockten Fahrzeug auf Spiel prüfen', 'Bei Tempo 60 auf Brummen achten'],
    effort: 'Werkstatt',
    partCostMinEur: 60,
    partCostMaxEur: 120,
    laborHours: 1.5,
    safetyNote: 'Ein defektes Radlager kann blockieren – lass das zeitnah in der Werkstatt prüfen.',
  },
  oelfilter: {
    name: 'Ölfilter',
    exists: false,
    fn: 'Der Ölfilter hält Abrieb aus dem Motoröl zurück.',
    symptoms: [],
    effort: 'Werkstatt',
    note: 'Dein Fahrzeug fährt elektrisch und hat keinen Verbrennungsmotor – deshalb gibt es weder Motoröl noch einen Ölfilter. Regelmäßig zu prüfen sind stattdessen Bremsflüssigkeit und der Kühlkreislauf der Hochvoltbatterie.',
  },
}

/** 1×1-PNG – geprüft wird die Anzeige samt Lizenz, nicht der Bildinhalt */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let commonsCalls = 0

const preview = await ensurePreview(process.argv[2])

try {
  const browser = await chromium.launch()
  const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' })

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

  await context.route('**/generativelanguage.googleapis.com/**:generateContent*', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    const frage = JSON.stringify(body.contents ?? '')
    asked.push({ toolName: body.tools?.[0]?.functionDeclarations?.[0]?.name, frage })
    const args = /ölfilter|olfilter/i.test(frage) ? ANSWERS.oelfilter : ANSWERS.radlager
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          { content: { parts: [{ functionCall: { name: 'bauteil_erklaeren', args } }] } },
        ],
      }),
    })
  })

  // --- Wikimedia Commons: Bauteilfoto samt Lizenzangaben ---
  await context.route('**/commons.wikimedia.org/w/api.php*', async (route) => {
    commonsCalls++
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: {
          pages: {
            1: {
              title: 'File:Brake disc caliper closeup.jpg',
              index: 1,
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/meraq-test.jpg',
                  url: 'https://upload.wikimedia.org/meraq-test.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Brake_disc.jpg',
                  thumbwidth: 640,
                  thumbheight: 480,
                  extmetadata: {
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    Artist: { value: '<a href="https://example.org">Testfotografin</a>' },
                  },
                },
              ],
            },
            // Eine Zeichnung, die die Auswahl aussortieren muss
            2: {
              title: 'File:Brake disc diagram.svg',
              index: 2,
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/diagram.svg',
                  extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
                },
              ],
            },
          },
        },
      }),
    })
  })
  await context.route('**/upload.wikimedia.org/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  })

  const page = await context.newPage()
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 200)}`))

  const goto = async (hash) => {
    await page.evaluate((h) => (window.location.hash = h), hash)
    await page.waitForTimeout(700)
  }
  const text = () => page.evaluate(() => document.body.innerText)
  // Am Sheet selbst prüfen: der Text eines Bauteils steht auch in der Liste darunter
  const sheetText = async () => {
    const sheet = page.locator('.anim-sheet')
    return (await sheet.count()) ? sheet.first().innerText() : ''
  }

  await page.goto(preview.base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
  await page.waitForTimeout(400)

  // --- Schlüssel hinterlegen, sonst kommt nur der Hinweis auf die Einstellungen ---
  await goto('#/settings')
  await page.locator('input[type="password"]').fill('AIzaTestSchluessel')
  await page.getByRole('button', { name: 'Speichern & prüfen' }).click()
  await page.waitForTimeout(1200)

  // --- Suche findet die fest hinterlegten Bauteile über alle Zonen ---
  await goto('#/manual')
  const suche = page.getByLabel('Bauteil suchen')
  await suche.fill('brems')
  await page.waitForTimeout(400)
  const trefferListe = await text()
  for (const begriff of ['Bremsscheibe & Sattel', 'Bremsflüssigkeitsbehälter']) {
    if (!trefferListe.includes(begriff)) problems.push(`[suche] "${begriff}" fehlt in den Treffern`)
  }
  if (!trefferListe.includes('Fahrwerk')) {
    problems.push('[suche] Die Zone wird zum Treffer nicht genannt – die Suche geht über alle Zonen')
  }
  await page.screenshot({ path: `${OUT}/treffer-lokal.png` })

  // Ein Treffer öffnet das Bauteil-Sheet
  await page.getByRole('button', { name: /Bremsscheibe & Sattel/ }).first().click()
  // Auf das Foto warten statt auf die Uhr – unter Last dauert das Nachladen länger
  await page
    .locator('.anim-sheet figure img')
    .waitFor({ timeout: 20000 })
    .catch(() => problems.push('[foto] Das Bild erscheint nicht innerhalb von 20 Sekunden'))
  const sheet = await text()
  if (!sheet.includes('Wandelt Bewegungsenergie')) {
    problems.push('[suche] Der Treffer öffnet das Bauteil nicht')
  }

  // --- Bauteilfoto: ohne Urheber und Lizenz darf es nicht gezeigt werden ---
  const fotos = await page.locator('.anim-sheet figure img').count()
  if (!fotos) problems.push('[foto] Zum Bauteil wird kein Foto angezeigt')
  if (!sheet.includes('Testfotografin')) problems.push('[foto] Der Urheber fehlt am Bild')
  if (!sheet.includes('CC BY-SA 4.0')) problems.push('[foto] Die Lizenz fehlt am Bild')
  if (!sheet.includes('Wikimedia Commons')) problems.push('[foto] Die Quelle wird nicht genannt')
  await page.screenshot({ path: `${OUT}/bauteil-foto.png` })

  // --- Auch ein hinterlegtes Bauteil bekommt die Vertiefung mit Kostenrahmen ---
  // Ein Teil, das die App kennt, darf nicht schlechter erklärt werden als eines,
  // das der Nutzer selbst eingetippt hat.
  await page.getByRole('button', { name: /Für mein Fahrzeug/ }).click()
  await page.waitForTimeout(2000)
  const vertieft = await sheetText()
  if (!/225\s*€/.test(vertieft) || !/285\s*€/.test(vertieft)) {
    problems.push('[vertiefung] Das hinterlegte Bauteil bekommt keinen Kostenrahmen')
  }
  if (!vertieft.includes('Brummen, das mit der Geschwindigkeit steigt')) {
    problems.push('[vertiefung] Die Symptome der KI fehlen beim hinterlegten Bauteil')
  }
  if (!vertieft.includes('Nachfragen')) {
    problems.push('[vertiefung] Die freie Nachfrage wird nicht angeboten')
  }
  await page.screenshot({ path: `${OUT}/bauteil-vertieft.png` })
  // "Fertig" im Sheet-Kopf. Die Fläche mit aria-label "Schließen" liegt hinter
  // dem Sheet – ein Klick darauf trifft in Playwright das Sheet selbst.
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(500)

  // --- Unbekanntes Bauteil: die KI erklärt es mit Kostenrahmen ---
  await suche.fill('Radlager')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /von der KI erklären lassen/ }).click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/ki-erklaerung.png` })

  const erklaerung = await text()
  const erwartet = [
    ['Funktion', 'Radlager führt das Rad'],
    ['Lage', 'In der Radnabe'],
    ['Symptome', 'Brummen, das mit der Geschwindigkeit steigt'],
    ['Selbstprüfung', 'Rad am aufgebockten Fahrzeug'],
    ['Aufwand', 'Werkstatt'],
    ['Sicherheitshinweis', 'kann blockieren'],
  ]
  for (const [was, begriff] of erwartet) {
    if (!erklaerung.includes(begriff)) problems.push(`[ki] ${was} fehlt in der Anzeige`)
  }

  // Kostenrahmen: Teil 60–120 € + 1,5 h × 110 €/h (Vorgabe) = 225–285 €
  if (!/225\s*€/.test(erklaerung) || !/285\s*€/.test(erklaerung)) {
    problems.push('[kosten] Die Summe stimmt nicht mit dem Stundensatz überein (erwartet 225–285 €)')
  }
  if (!erklaerung.includes('110 €/h')) problems.push('[kosten] Der Stundensatz wird nicht offengelegt')
  if (!erklaerung.includes('Schätzung')) problems.push('[kosten] Der Schätzungs-Hinweis fehlt')

  if (asked.at(-1)?.toolName !== 'bauteil_erklaeren') {
    problems.push('[ki] Die Anfrage ging nicht als strukturierter Aufruf hinaus')
  }
  if (!/BMW|Fahrzeug/i.test(JSON.stringify(asked.at(-1)?.frage ?? ''))) {
    // Der Fahrzeugkontext steckt im System-Prompt, die Frage nennt das Bauteil
    if (!/Radlager/i.test(asked.at(-1)?.frage ?? '')) {
      problems.push('[ki] Der Suchbegriff steht nicht in der Anfrage')
    }
  }

  // "Fertig" im Sheet-Kopf. Die Fläche mit aria-label "Schließen" liegt hinter
  // dem Sheet – ein Klick darauf trifft in Playwright das Sheet selbst.
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(500)

  // --- Sprung ins Modell: /manual?teil=<id> öffnet Zone, Bauteil und Sheet ---
  await goto('#/manual?teil=exhaust')
  await page.waitForTimeout(900)
  const sprung = await sheetText()
  if (!sprung.includes('Abgasanlage')) {
    problems.push(`[sprung] /manual?teil=exhaust öffnet das Bauteil nicht (Sheet: ${sprung.slice(0, 40)})`)
  }
  if (!sprung.includes('Führt Abgase ab')) {
    problems.push('[sprung] Das Bauteil-Sheet zeigt die Funktion nicht')
  }
  const zonenTitel = await page
    .locator('div.overflow-x-auto > button.brand-gradient')
    .first()
    .innerText()
  if (!/Fahrwerk/.test(zonenTitel)) {
    problems.push(`[sprung] Es wurde nicht in die passende Zone gewechselt (aktiv: ${zonenTitel})`)
  }
  await page.screenshot({ path: `${OUT}/sprung-ins-modell.png` })
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(500)

  // Der Parameter muss verbraucht sein, sonst öffnet sich das Sheet endlos neu
  if ((await page.evaluate(() => window.location.hash)).includes('teil=')) {
    problems.push('[sprung] Der Parameter bleibt in der Adresse stehen')
  }
  if (await page.locator('.anim-sheet').count()) {
    problems.push('[sprung] Das Sheet öffnet sich nach dem Schließen erneut')
  }

  // --- Verweis aus der Diagnose zeigt auf das richtige Bauteil ---
  await goto('#/diagnosis')
  await page.getByRole('button', { name: 'Fehlercode eintragen' }).first().click()
  await page.waitForTimeout(500)
  await page.getByPlaceholder('Code oder Stichwort, z. B. P0300').fill('P0420')
  await page.waitForTimeout(500)
  await page.getByText('P0420', { exact: false }).last().click()
  await page.waitForTimeout(800)
  await page.getByText('P0420', { exact: false }).last().click()
  await page.waitForTimeout(800)
  const codeDetail = await text()
  if (!codeDetail.includes('Wo sitzt das am Fahrzeug?')) {
    problems.push('[diagnose] Der Verweis ins Modell fehlt am Fehlercode')
  }
  await page.screenshot({ path: `${OUT}/diagnose-verweis.png` })

  // --- Fahrzeugunabhängigkeit: E-Auto anlegen und nach dem Ölfilter fragen ---
  await goto('#/vehicle/new')
  await page.getByRole('button', { name: 'Auto', exact: true }).click()
  await page.getByPlaceholder('z. B. Volkswagen').fill('Tesla')
  await page.getByPlaceholder('z. B. Golf').fill('Model 3')
  const numbers = page.locator('input[type="number"]')
  await numbers.nth(0).fill('2022')
  await numbers.nth(1).fill('48000')
  await numbers.nth(2).fill('208')
  await page.locator('select').nth(0).selectOption('Elektro')
  await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()
  await page.waitForTimeout(900)

  await goto('#/manual')
  await page.getByLabel('Bauteil suchen').fill('Ölfilter')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /von der KI erklären lassen/ }).click()
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/gibt-es-nicht.png` })

  const eAuto = await text()
  if (!eAuto.includes('Gibt es an Deinem Fahrzeug nicht')) {
    problems.push('[fahrzeugunabhängigkeit] Fehlender Hinweis, dass es das Bauteil hier nicht gibt')
  }
  if (!eAuto.includes('keinen Verbrennungsmotor')) {
    problems.push('[fahrzeugunabhängigkeit] Die Begründung der KI wird nicht angezeigt')
  }
  if (/\d+\s*€\s*–\s*\d+\s*€/.test(eAuto)) {
    problems.push('[fahrzeugunabhängigkeit] Für ein nicht vorhandenes Bauteil werden Kosten genannt')
  }

  // --- Das Foto wird nur einmal geholt, danach liegt es auf dem Gerät ---
  await page.getByRole('button', { name: 'Fertig' }).click() // KI-Sheet zu
  await page.waitForTimeout(400)
  const nachErstemAufruf = commonsCalls
  await goto('#/manual?teil=brake-disc')
  await page.waitForTimeout(1500)
  if (commonsCalls > nachErstemAufruf) {
    problems.push(`[foto] Bei jedem Öffnen geht eine neue Anfrage hinaus (${commonsCalls})`)
  }
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForTimeout(400)

  // --- Kein horizontales Scrollen, auch mit langer Trefferliste ---
  const breite = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  if (breite.scrollW > breite.clientW + 1) {
    problems.push(`[layout] horizontales Scrollen: ${breite.scrollW} > ${breite.clientW}`)
  }

  await browser.close()
} finally {
  preview.stop()
}

if (problems.length) {
  console.log('PROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log(`OK – Bauteil-Suche: lokale Treffer, KI-Erklärung mit Kostenrahmen, ehrliches Nein beim E-Auto.`)
console.log(`Screenshots in ${OUT}/`)
