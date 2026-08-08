/**
 * Prüft die reine Logik rund um die Bauteil-Suche: den Kostenrahmen und die
 * Zuordnung von Fehlercodes und Ersatzteilen zur Stelle im Modell.
 *
 * Beim Kostenrahmen steht die Zahl neben einer KI-Antwort – der Nutzer kann
 * nicht sehen, welcher Teil geschätzt und welcher gerechnet ist. Bei der
 * Zuordnung wäre ein Sprung zum falschen Bauteil schlimmer als gar keiner.
 *
 * Aufruf: npm run test:part
 */
import { partCostEstimate } from '../src/lib/partCost.ts'
import { findHotspotId, zoneOfHotspot } from '../src/data/manual.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

console.log('Vollständige Angabe')
{
  const c = partCostEstimate({ partCostMinEur: 60, partCostMaxEur: 120, laborHours: 1.5 }, 110)
  check('Arbeitskosten = 1,5 h × 110 €', c.laborCost === 165, `${c.laborCost}`)
  check('Summe unten = Teil + Arbeit', c.totalMin === 225, `${c.totalMin}`)
  check('Summe oben = Teil + Arbeit', c.totalMax === 285, `${c.totalMax}`)
  check('Rechnung offengelegt', c.formula.includes('110 €/h') && c.formula.includes('60 €'), c.formula)
}

console.log('Nur Ersatzteil bekannt')
{
  const c = partCostEstimate({ partCostMinEur: 25, partCostMaxEur: 40 }, 110)
  check('keine Arbeitskosten', c.laborCost === undefined)
  check('keine Summe, solange die Arbeitszeit fehlt', c.totalMin === undefined && c.totalMax === undefined)
  check('Teilespanne trotzdem sichtbar', c.formula.includes('25 €') && c.formula.includes('40 €'), c.formula)
}

console.log('Nur Arbeitszeit bekannt')
{
  const c = partCostEstimate({ laborHours: 2 }, 130)
  check('Arbeitskosten = 2 h × 130 €', c.laborCost === 260, `${c.laborCost}`)
  check('keine Summe ohne Teilepreis', c.totalMin === undefined)
}

console.log('Unbrauchbare Angaben')
{
  check('gar nichts bekannt → null', partCostEstimate({}, 110) === null)
  check('nur Nullwerte → null', partCostEstimate({ partCostMinEur: 0, laborHours: 0 }, 110) === null)
  check(
    'negative Werte zählen nicht',
    partCostEstimate({ partCostMinEur: -50, laborHours: -1 }, 110) === null,
  )
  const absurd = partCostEstimate({ partCostMinEur: 80, laborHours: 40 }, 110)
  check('40 Stunden sind ein Missverständnis, keine Position', absurd.laborCost === undefined)
}

console.log('Randfälle')
{
  const vertauscht = partCostEstimate({ partCostMinEur: 200, partCostMaxEur: 80, laborHours: 1 }, 100)
  check('vertauschte Grenzen werden gedreht', vertauscht.partsMin === 80 && vertauscht.partsMax === 200)
  check('Summe folgt der gedrehten Spanne', vertauscht.totalMin === 180 && vertauscht.totalMax === 300)

  const einzeln = partCostEstimate({ partCostMinEur: 90, laborHours: 0.5 }, 120)
  check('eine einzelne Zahl wird zur Spanne', einzeln.partsMin === 90 && einzeln.partsMax === 90)
  check('Anzeige nennt sie nur einmal', einzeln.formula.startsWith('Teil 90 €'), einzeln.formula)

  const ohneSatz = partCostEstimate({ partCostMinEur: 90, laborHours: 1 }, 0)
  check('ohne Stundensatz keine Arbeitskosten', ohneSatz.laborCost === undefined)
}

const vehicle = (patch = {}) => ({
  id: 'v1',
  kind: 'car',
  make: 'BMW',
  model: '320d',
  year: 2018,
  mileage: 120000,
  mileageUpdatedAt: '2026-08-01T00:00:00.000Z',
  fuel: 'Diesel',
  transmission: 'Automatik',
  powerKw: 140,
  condition: 'gut',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...patch,
})

console.log('Zuordnung Fehlercode und Teil → Bauteil')
{
  const diesel = vehicle()
  const faelle = [
    ['Katalysator-Wirkungsgrad zu gering', 'exhaust'],
    ['ABS-Sensor vorne links – Signal fehlerhaft', 'wheel-sensor'],
    ['Bremsflüssigkeit', 'brake-fluid'],
    ['Bremsbeläge vorne', 'brake-disc'],
    ['Luftmassenmesser', 'air-filter-box'],
    ['Ölfilter', 'oil-filter-housing'],
    ['Innenraumfilter', 'cabin-filter'],
    ['Ladedruck zu niedrig', 'turbo'],
  ]
  for (const [text, erwartet] of faelle) {
    const treffer = findHotspotId(text, diesel)
    check(`"${text}" → ${erwartet}`, treffer === erwartet, `gefunden: ${treffer ?? 'nichts'}`)
  }

  check(
    'Das genauere Stichwort gewinnt (Bremsflüssigkeit vor Bremsen)',
    findHotspotId('Bremsflüssigkeit wechseln – Bremsen prüfen', diesel) === 'brake-fluid',
  )
  check('Ohne Bezug kein Sprung', findHotspotId('Steuergerät Komfortsystem', diesel) === undefined)
  check('Zone wird mitgeliefert', zoneOfHotspot('exhaust', diesel) === 'chassis')
}

console.log('Zuordnung bleibt fahrzeuggerecht')
{
  const eAuto = vehicle({ fuel: 'Elektro', make: 'Tesla', model: 'Model 3' })
  const bike = vehicle({ kind: 'motorcycle', make: 'Honda', model: 'CB 650 R', fuel: 'Benzin' })

  check('E-Auto springt nicht zum Ölfilter', findHotspotId('Ölfilter', eAuto) === undefined)
  check('E-Auto springt nicht zum Turbolader', findHotspotId('Ladedruck', eAuto) === undefined)
  check('E-Auto findet die Hochvoltbatterie', findHotspotId('Hochvoltbatterie', eAuto) === 'hv-battery')
  check('E-Auto findet die Bremsscheibe weiterhin', findHotspotId('Bremsbeläge', eAuto) === 'brake-disc')
  check('Motorrad springt nicht zum Innenraumfilter', findHotspotId('Innenraumfilter', bike) === undefined)
  check('Motorrad findet die Antriebskette', findHotspotId('Kettenkit', bike) === 'chain')
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – Kostenrahmen und Bauteil-Zuordnung stimmen.')
