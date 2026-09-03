/**
 * Prüft den ganzen Weg „Rechnung erklären" – mit abgefangener KI-Antwort,
 * also ohne Guthabenverbrauch.
 *
 * Geprüft wird, was der Nutzer sieht: dass jede Zeile in Alltagssprache
 * dasteht, dass das betroffene Bauteil samt Foto und Sprung ins Modell
 * auftaucht, dass die Preis-Einordnung aus dem eingestellten Stundensatz
 * gerechnet ist – und dass nichts gespeichert wird, bevor er es bestätigt.
 *
 * Aufruf: npm run test:invoicescan
 */
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { ensurePreview } from './preview-server.mjs'

const OUT = 'screenshots/rechnung'
mkdirSync(OUT, { recursive: true })

const problems = []
const asked = []

/** So, wie die KI eine typische Inspektionsrechnung zurückgibt */
const ANSWER = {
  readable: true,
  workshop: 'Autohaus Beispiel',
  date: '2026-07-14',
  totalGrossEur: 5450,
  mileage: 91240,
  summary:
    'Es wurde die fällige Inspektion mit Ölwechsel gemacht und zusätzlich der Turbolader ersetzt. Der Ölservice ist Routine, der Turbolader ist eine echte Reparatur.',
  positions: [
    {
      label: 'Ölservice: Motoröl 5W-30 und Ölfilter',
      plain: 'Das alte Motoröl wurde abgelassen und neues eingefüllt, dazu kam ein neuer Ölfilter.',
      why: 'Öl altert und verliert seine Schmierwirkung. Ohne Wechsel verschleißt der Motor deutlich schneller.',
      partHint: 'Ölfilter',
      jobId: 'oil-service',
      priceEur: 165,
      kind: 'Wartung',
      necessity: 'nötig',
    },
    {
      label: 'Turbolader ersetzt',
      plain: 'Der Turbolader presst zusätzliche Luft in den Motor. Er wurde komplett getauscht.',
      why: 'Ein defekter Turbolader kostet Leistung und kann Öl in den Ansaugtrakt drücken.',
      partHint: 'Turbolader',
      jobId: 'turbo',
      priceEur: 4900,
      kind: 'Reparatur',
      necessity: 'nötig',
    },
    {
      label: 'Querlenker vorne links ersetzt',
      plain: 'Ein Teil der Radaufhängung wurde getauscht – es verbindet das Rad mit der Karosserie und hält es in Spur.',
      why: 'Sind die Gummilager im Querlenker ausgeschlagen, poltert es und die Spur stimmt nicht mehr.',
      partHint: 'Querlenker',
      imageQuery: 'car control arm suspension',
      location: 'Unten an der Vorderachse, zwischen Radträger und Karosserie.',
      zone: 'chassis',
      priceEur: 289.9,
      kind: 'Reparatur',
      necessity: 'nötig',
    },
    {
      label: 'Altölentsorgung',
      plain: 'Gebühr für die vorschriftsmäßige Entsorgung des alten Motoröls.',
      kind: 'Sonstiges',
      necessity: 'nötig',
      priceEur: 12,
    },
  ],
  questions: ['Wurde der Dichtring der Ablassschraube mit erneuert?'],
  followUp: ['Der nächste Ölwechsel ist in rund 15.000 km fällig.'],
  maintenanceKinds: ['oil'],
}

/** 1×1-PNG – geprüft wird die Anzeige, nicht der Bildinhalt */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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
    asked.push({
      toolName: body.tools?.[0]?.functionDeclarations?.[0]?.name,
      hasImage: JSON.stringify(body.contents ?? '').includes('inlineData'),
      jobEnum: JSON.stringify(
        body.tools?.[0]?.functionDeclarations?.[0]?.parameters?.properties?.positions?.items?.properties
          ?.jobId?.enum ?? [],
      ),
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          { content: { parts: [{ functionCall: { name: 'rechnung_erklaeren', args: ANSWER } }] } },
        ],
      }),
    })
  })

  await context.route('**/commons.wikimedia.org/w/api.php*', async (route) => {
    // Der Dateiname richtet sich nach dem Suchbegriff – sonst weist die Auswahl
    // den Treffer zu Recht ab, und der Test prüfte nur seine eigene Attrappe
    const term = decodeURIComponent(
      new URL(route.request().url()).searchParams.get('gsrsearch') ?? 'car part',
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: {
          pages: {
            1: {
              title: `File:${term} closeup photo.jpg`,
              index: 1,
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/meraq-test.jpg',
                  url: 'https://upload.wikimedia.org/meraq-test.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Oil_filter.jpg',
                  thumbwidth: 640,
                  thumbheight: 480,
                  extmetadata: {
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    Artist: { value: '<a href="https://example.org">Testfotografin</a>' },
                  },
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

  await page.goto(preview.base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Überspringen' }).click({ timeout: 15000 })
  await page.waitForTimeout(400)

  // --- Ohne Schlüssel muss die App den Weg zur Einrichtung zeigen, nicht abstürzen ---
  await goto('#/invoice')
  await page.setInputFiles('input[aria-label="Rechnungsbild wählen"]', {
    name: 'rechnung.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await page.waitForTimeout(800)
  const ohneSchluessel = await text()
  if (!/KI-Schlüssel/.test(ohneSchluessel) || !/kostenlos/i.test(ohneSchluessel)) {
    problems.push('[ohne-schlüssel] Kein Hinweis auf den fehlenden Schlüssel samt kostenlosem Weg')
  }
  await page.screenshot({ path: `${OUT}/ohne-schluessel.png` })

  // --- Schlüssel hinterlegen ---
  await goto('#/settings')
  await page.locator('input[type="password"]').fill('AIzaTestSchluessel')
  await page.getByRole('button', { name: 'Speichern & prüfen' }).click()
  await page.waitForTimeout(1200)

  // --- Ein bekanntes Fahrzeug anlegen, damit die Preisspanne nachvollziehbar ist ---
  await goto('#/vehicle/new')
  await page.getByRole('button', { name: 'Auto', exact: true }).click()
  await page.getByPlaceholder('z. B. Volkswagen').fill('Volkswagen')
  await page.getByPlaceholder('z. B. Golf').fill('Golf')
  const numbers = page.locator('input[type="number"]')
  await numbers.nth(0).fill('2018')
  await numbers.nth(1).fill('90000')
  await numbers.nth(2).fill('110')
  await page.getByRole('button', { name: 'Fahrzeug anlegen' }).click()
  await page.waitForTimeout(900)

  // --- Rechnung scannen ---
  await goto('#/invoice')
  await page.setInputFiles('input[aria-label="Rechnungsbild wählen"]', {
    name: 'rechnung.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/erklaerung.png`, fullPage: true })

  const erklaert = await text()

  // Die Anfrage muss strukturiert und mit Bild hinausgegangen sein
  const letzte = asked.at(-1)
  if (letzte?.toolName !== 'rechnung_erklaeren') {
    problems.push(`[ki] Die Anfrage ging nicht als strukturierter Aufruf hinaus (${letzte?.toolName})`)
  }
  if (!letzte?.hasImage) problems.push('[ki] Das Bild der Rechnung wurde nicht mitgeschickt')
  if (!/oil-service/.test(letzte?.jobEnum ?? '')) {
    problems.push('[ki] Die Werkstattpositionen des Fahrzeugs stehen nicht im Schema')
  }

  // Jede Zeile in Alltagssprache
  for (const [was, begriff] of [
    ['Zusammenfassung', 'fällige Inspektion mit Ölwechsel'],
    ['Wortlaut der Rechnung', 'Ölservice: Motoröl 5W-30'],
    ['Erklärung', 'Das alte Motoröl wurde abgelassen'],
    ['Begründung', 'Öl altert und verliert seine Schmierwirkung'],
    ['Werkstatt', 'Autohaus Beispiel'],
    ['Rückfrage an die Werkstatt', 'Dichtring der Ablassschraube'],
    ['Was daraus folgt', 'nächste Ölwechsel'],
  ]) {
    if (!erklaert.includes(begriff)) problems.push(`[erklärung] ${was} fehlt in der Anzeige`)
  }

  // Preis-Einordnung: gerechnet, nicht geraten
  if (!erklaert.includes('Üblich für Dein Fahrzeug')) {
    problems.push('[preis] Die übliche Spanne fehlt')
  }
  if (!erklaert.includes('110 €/h')) problems.push('[preis] Der Stundensatz wird nicht offengelegt')
  if (!erklaert.includes('im Rahmen')) {
    problems.push('[preis] Der Ölservice für 165 € gilt nicht als „im Rahmen"')
  }
  if (!erklaert.includes('deutlich darüber')) {
    problems.push('[preis] Der Turbolader für 4.900 € wird nicht als auffällig erkannt')
  }
  if (!erklaert.includes('kein Vorwurf')) {
    problems.push('[preis] Bei einer auffälligen Zeile fehlt der Hinweis, nachzufragen statt zu unterstellen')
  }
  // Die Gebühr hat keine Vergleichsposition – dort darf keine Spanne stehen
  // Die Schätzungsnotiz am Seitenende nennt denselben Begriff ohne Doppelpunkt
  if ((erklaert.match(/Üblich für Dein Fahrzeug:/g) ?? []).length !== 2) {
    problems.push('[preis] Es wird für mehr oder weniger Zeilen eine Spanne gezeigt als erwartet')
  }

  // --- Das Bauteil: Foto und Sprung ins Modell ---
  // Auch Teile, die die App nicht fest kennt (Querlenker), muessen ein Bild und
  // eine Verortung bekommen – sonst bleibt genau die Frage offen, wegen der man
  // die Rechnung ueberhaupt scannt
  if (!erklaert.includes('Querlenker vorne links ersetzt')) {
    problems.push('[erklärung] Die unbekannte Position fehlt in der Anzeige')
  }
  const aufklappen = page.getByRole('button', { name: /Wie das Teil aussieht/ })
  const anzahl = await aufklappen.count()
  if (anzahl !== 3) {
    problems.push(`[bild] Es gibt ${anzahl} aufklappbare Bauteile statt 3 (Gebuehrenzeile darf keines haben)`)
  }
  for (let i = 0; i < anzahl; i++) await aufklappen.nth(i).click()
  await page.waitForTimeout(400)
  await page
    .locator('figure img')
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => problems.push('[foto] Zum Bauteil erscheint kein Bild'))
  const mitFoto = await text()
  if (!mitFoto.includes('Testfotografin')) problems.push('[foto] Der Urheber fehlt am Bild')
  if (!mitFoto.includes('CC BY-SA 4.0')) problems.push('[foto] Die Lizenz fehlt am Bild')
  if (!/Wo sitzt .*am Fahrzeug/.test(mitFoto)) {
    problems.push('[modell] Der Sprung zur Stelle am Fahrzeug fehlt')
  }
  if (!mitFoto.includes('Unten an der Vorderachse')) {
    problems.push('[modell] Beim unbekannten Teil fehlt die Angabe, wo es sitzt')
  }
  if (!mitFoto.includes('Bereich am Fahrzeug zeigen')) {
    problems.push('[modell] Beim unbekannten Teil fehlt der Weg in den Bereich des Modells')
  }
  const bilder = await page.locator('figure img').count()
  if (bilder < 3) problems.push(`[foto] Nur ${bilder} von 3 Bauteilen zeigen ein Bild`)
  await page.screenshot({ path: `${OUT}/bauteil.png` })


  // Der Verweis führt wirklich ins Modell
  await page.getByRole('link', { name: /Wo sitzt/ }).first().click()
  await page.waitForTimeout(1200)
  const imModell = await text()
  if (!/Ölfilter/.test(imModell)) {
    problems.push('[modell] Der Sprung öffnet nicht das passende Bauteil')
  }
  await page.screenshot({ path: `${OUT}/im-modell.png` })

  // --- Nichts wird ohne Bestätigung gespeichert ---
  await goto('#/more')
  if ((await text()).includes('Autohaus Beispiel')) {
    problems.push('[übernahme] Der Beleg landete im Verlauf, ohne dass er bestätigt wurde')
  }

  await goto('#/invoice')
  await page.setInputFiles('input[aria-label="Rechnungsbild wählen"]', {
    name: 'rechnung.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Ölwechsel' }).first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await page.waitForTimeout(600)
  const nachher = await text()
  if (!nachher.includes('Übernommen')) problems.push('[übernahme] Keine Rückmeldung nach dem Speichern')
  await page.screenshot({ path: `${OUT}/uebernommen.png` })

  // Der Bereichs-Verweis eines nicht hinterlegten Teils muss im Modell die
  // richtige Zone aufschlagen. Zuletzt geprüft, weil er den Screen verlässt.
  const klappen = page.getByRole('button', { name: /Wie das Teil aussieht/ })
  for (let i = 0; i < (await klappen.count()); i++) await klappen.nth(i).click()
  await page.waitForTimeout(400)
  await page.getByRole('link', { name: 'Bereich am Fahrzeug zeigen' }).first().click()
  await page.waitForTimeout(1500)
  const zone = await page.locator('div.overflow-x-auto > button.brand-gradient').first().innerText()
  if (!/Fahrwerk/.test(zone)) {
    problems.push(`[modell] Der Bereichs-Verweis öffnet die falsche Zone (aktiv: ${zone})`)
  }
  if ((await page.evaluate(() => window.location.hash)).includes('bereich=')) {
    problems.push('[modell] Der Bereichs-Parameter bleibt in der Adresse stehen')
  }
  await page.screenshot({ path: `${OUT}/bereich.png` })

  await goto('#/more')
  // Auf die Zeile warten statt auf die Uhr – nach dem Modell-Umweg braucht der
  // Screen einen Moment, und ein fester Wert macht die Pruefung launisch
  await page
    .getByText('Autohaus Beispiel')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {})
  const verlauf = await text()
  if (!verlauf.includes('Autohaus Beispiel')) {
    problems.push('[übernahme] Der Beleg steht nicht im Verlauf')
  }
  if (!/5\.450/.test(verlauf)) problems.push('[übernahme] Der Betrag fehlt im Verlauf')

  await goto('#/maintenance')
  await page.getByRole('button', { name: /Ölwechsel/ }).first().click()
  await page.waitForTimeout(600)
  const wartung = await text()
  if (!wartung.includes('91.240')) {
    problems.push('[übernahme] Die Wartungsposition steht nicht auf dem Kilometerstand des Belegs')
  }
  await page.screenshot({ path: `${OUT}/wartungsplan.png` })

  // --- Kein horizontales Scrollen ---
  await goto('#/invoice')
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
console.log('OK – Rechnung erklärt: jede Zeile in Alltagssprache, Bauteil mit Foto und Modell,')
console.log(`gerechnete Preis-Einordnung, Übernahme erst auf Bestätigung. Screenshots in ${OUT}/`)
