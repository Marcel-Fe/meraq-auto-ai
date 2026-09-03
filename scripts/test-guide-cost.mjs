/**
 * Prüft die Rechnung hinter „selbst machen oder machen lassen" und die
 * Zuordnung Anleitung → Werkstattposition.
 *
 * Die Zahl steht neben einer Kaufentscheidung: Wer glaubt, 200 € zu sparen,
 * legt sich unter sein Auto. Deshalb ohne Netz und ohne KI prüfbar.
 *
 * Aufruf: npm run test:guide
 */
import { guideCostComparison } from '../src/lib/guideCost.ts'
import { sanitizeAdaptation } from '../src/lib/guideAdapt.ts'
import { GUIDES, guidesFor } from '../src/data/guides.ts'
import { findHotspotId } from '../src/data/manual.ts'
import { repairJobsFor } from '../src/data/parts.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

const vehicle = (patch = {}) => ({
  id: 'v1',
  kind: 'car',
  make: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  mileage: 90000,
  mileageUpdatedAt: '2026-08-01T00:00:00.000Z',
  fuel: 'Benzin',
  transmission: 'Schaltgetriebe',
  powerKw: 110,
  condition: 'gut',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...patch,
})

console.log('Die Rechnung')
{
  const c = guideCostComparison({ laborHours: 0.7, partsMinEur: 55, partsMaxEur: 120 }, 110, 45)
  check('Arbeitskosten = 0,7 h × 110 €', c.laborCost === 77, `${c.laborCost}`)
  check('Werkstatt = Teile + Arbeit', c.workshopMin === 132 && c.workshopMax === 197, `${c.workshopMin}/${c.workshopMax}`)
  check('Selbst = nur die Teile', c.diyMin === 55 && c.diyMax === 120)
  check('Ersparnis ist die Arbeitszeit', c.saving === 77, `${c.saving}`)
  check('Gegenwert der eigenen Stunde', c.savingPerHour === Math.round(77 / (45 / 60)), `${c.savingPerHour}`)
  check('Rechnung offengelegt', c.formula.includes('110 €/h') && c.formula.includes('55 €'), c.formula)
}

console.log('Position ohne Material')
{
  const c = guideCostComparison({ laborHours: 0.6, partsMinEur: 0, partsMaxEur: 0 }, 120, 45)
  check('Werkstatt = reine Arbeit', c.workshopMin === 72 && c.workshopMax === 72, `${c.workshopMin}`)
  check('Selbst kostet nichts', c.diyMin === 0 && c.diyMax === 0)
  check('Anzeige sagt „ohne Material"', c.formula.startsWith('ohne Material'), c.formula)
}

console.log('Unbrauchbare Angaben')
{
  check('ohne Werkstattposition kein Vergleich', guideCostComparison(undefined, 110, 45) === null)
  check(
    'ohne Stundensatz kein Vergleich',
    guideCostComparison({ laborHours: 1, partsMinEur: 20, partsMaxEur: 40 }, 0, 45) === null,
  )
  check(
    'ohne Arbeitszeit kein Vergleich',
    guideCostComparison({ laborHours: 0, partsMinEur: 20, partsMaxEur: 40 }, 110, 45) === null,
  )
  const gedreht = guideCostComparison({ laborHours: 1, partsMinEur: 200, partsMaxEur: 80 }, 100, 60)
  check('vertauschte Grenzen werden gedreht', gedreht.diyMin === 80 && gedreht.diyMax === 200)
  const ohneZeit = guideCostComparison({ laborHours: 1, partsMinEur: 20, partsMaxEur: 40 }, 110, 0)
  check('ohne eigene Zeit keine Division durch null', ohneZeit.savingPerHour === undefined)
}

console.log('Zuordnung Anleitung → Werkstattposition')
{
  const golf = vehicle()
  const jobs = repairJobsFor(golf)
  for (const g of GUIDES) {
    if (!g.jobId) continue
    const bekannt = jobs.some((j) => j.id === g.jobId) || g.jobId === 'oil-service'
    check(`"${g.title}" verweist auf eine echte Position (${g.jobId})`, bekannt)
  }

  const mitVergleich = guidesFor(golf).filter((g) => g.jobId && jobs.some((j) => j.id === g.jobId))
  check('der Golf bekommt mehrere Vergleiche', mitVergleich.length >= 5, `${mitVergleich.length}`)
}

console.log('Vergleich bleibt fahrzeuggerecht')
{
  const eAuto = vehicle({ fuel: 'Elektro', make: 'Tesla', model: 'Model 3' })
  const bike = vehicle({ kind: 'motorcycle', make: 'Honda', model: 'CB 650 R' })

  const eJobs = repairJobsFor(eAuto)
  check('E-Auto hat keinen Ölservice', !eJobs.some((j) => j.id === 'oil-service'))
  check('E-Auto hat keinen Luftfilter', !eJobs.some((j) => j.id === 'air-filter'))
  check(
    'E-Auto bekommt für den Bremsenwechsel trotzdem einen Vergleich',
    !!guidesFor(eAuto).find((g) => g.id === 'brake-pads-front') &&
      eJobs.some((j) => j.id === 'brake-pads-front'),
  )

  const bikeJobs = repairJobsFor(bike)
  check('Motorrad bekommt kein Räder-Umstecken', !bikeJobs.some((j) => j.id === 'wheel-swap'))
  check('Motorrad bekommt keinen Innenraumfilter', !bikeJobs.some((j) => j.id === 'cabin-filter'))
}

console.log('Von der Anleitung zum Bauteil')
{
  const golf = vehicle()
  const ziel = (g) => findHotspotId([g.title, ...g.parts].join(' '), golf)
  const guide = (id) => GUIDES.find((g) => g.id === id)
  const faelle = [
    ['oil-change', 'oil-cap'],
    ['air-filter', 'air-filter-box'],
    ['brake-pads-front', 'brake-disc'],
    ['battery', 'battery'],
    ['cabin-filter', 'cabin-filter'],
    ['coolant', 'coolant-tank'],
    ['tire-change', 'tire'],
    ['jump-start', 'battery'],
  ]
  for (const [id, erwartet] of faelle) {
    const treffer = ziel(guide(id))
    check(`"${guide(id).title}" → ${erwartet}`, treffer === erwartet, `gefunden: ${treffer ?? 'nichts'}`)
  }
  check('Ohne Bezug kein Sprung', ziel(guide('wipers')) === undefined, `${ziel(guide('wipers'))}`)

  const eAuto = vehicle({ fuel: 'Elektro', make: 'Tesla', model: 'Model 3' })
  check(
    'E-Auto springt von der Batterie-Anleitung nicht ins Leere',
    findHotspotId([guide('battery').title, ...guide('battery').parts].join(' '), eAuto) === 'battery',
  )
}

console.log('Hinweise der KI zu den Schritten')
{
  const roh = {
    fits: true,
    summary: '  Beim 1.5 TSI sitzt der Filter unter der Abdeckung.  ',
    stepNotes: [
      { step: 2, note: 'Ablassschraube liegt hinter dem Unterfahrschutz' },
      { step: 2, note: 'doppelter Hinweis zum selben Schritt' },
      { step: 9, note: 'Schritt gibt es gar nicht' },
      { step: 0, note: 'auch nicht' },
      { step: 1, note: '   ' },
    ],
    specialTools: ['Ölfilternuss 74 mm', '  ', ''],
    pitfalls: ['Dichtring der Ablassschraube vergessen'],
    timeNoviceMin: 900,
  }
  const c = sanitizeAdaptation(roh, 6)
  check('nur ein Hinweis je Schritt', c.stepNotes.length === 1, JSON.stringify(c.stepNotes))
  check('Hinweis hängt am richtigen Schritt', c.stepNotes[0].step === 2)
  check('Schritte außerhalb der Anleitung fliegen raus', !c.stepNotes.some((n) => n.step > 6 || n.step < 1))
  check('leere Werkzeuge fliegen raus', c.specialTools.length === 1, JSON.stringify(c.specialTools))
  check('15 Stunden sind ein Missverständnis', c.timeNoviceMin === undefined, `${c.timeNoviceMin}`)
  check('Zusammenfassung ohne Leerraum', c.summary.startsWith('Beim'))

  const knapp = sanitizeAdaptation({ fits: undefined, summary: 'x' }, 4)
  check('fehlendes "fits" gilt als passend', knapp.fits === true)
  check('fehlende Listen werden zu leeren Listen', knapp.stepNotes.length === 0 && knapp.pitfalls.length === 0)
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – Vergleich und KI-Hinweise stimmen.')
