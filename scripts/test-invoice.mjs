/**
 * Prüft die reine Logik hinter „Rechnung erklären": die Preis-Einordnung, die
 * Vollständigkeitsprüfung und die Bereinigung der KI-Antwort.
 *
 * Hier steht eine Zahl neben einer echten Rechnung. Ein falsches „deutlich
 * darüber" wäre ein Vorwurf gegen eine Werkstatt, den die App nicht belegen
 * kann – deshalb ohne Netz und ohne KI prüfbar.
 *
 * Aufruf: npm run test:invoice
 */
import { coversTotal, positionPriceCheck, sumOfPositions } from '../src/lib/invoiceCheck.ts'
import { sanitizeInvoice } from '../src/lib/invoiceExplain.ts'
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

// Ölservice: Teile 55–120 €, 0,7 h – Referenzwerte der Vorlage
const oilJob = { laborHours: 0.7, partsMinEur: 55, partsMaxEur: 120 }

console.log('Preis-Einordnung')
{
  // üblich = 55+77 bis 120+77 = 132–197 €
  const c = positionPriceCheck({ priceEur: 165 }, oilJob, 110)
  check('Spanne = Teile + Arbeit', c.usualMin === 132 && c.usualMax === 197, `${c.usualMin}–${c.usualMax}`)
  check('165 € liegen im Rahmen', c.verdict === 'im Rahmen', c.verdict)
  check('Rechnung offengelegt', c.formula.includes('110 €/h') && c.formula.includes('55 €'), c.formula)

  check('100 € sind günstig', positionPriceCheck({ priceEur: 100 }, oilJob, 110).verdict === 'günstig')
  check(
    '15 % über der Obergrenze sind noch im Rahmen',
    positionPriceCheck({ priceEur: 226 }, oilJob, 110).verdict === 'im Rahmen',
    positionPriceCheck({ priceEur: 226 }, oilJob, 110).verdict,
  )
  check(
    '250 € liegen über dem Üblichen',
    positionPriceCheck({ priceEur: 250 }, oilJob, 110).verdict === 'über dem Üblichen',
  )
  check(
    '400 € sind deutlich darüber',
    positionPriceCheck({ priceEur: 400 }, oilJob, 110).verdict === 'deutlich darüber',
  )
}

console.log('Wann gar keine Einordnung')
{
  check('ohne Betrag keine Aussage', positionPriceCheck({}, oilJob, 110) === null)
  check('ohne Vergleichsposition keine Aussage', positionPriceCheck({ priceEur: 200 }, undefined, 110) === null)
  check('ohne Stundensatz keine Aussage', positionPriceCheck({ priceEur: 200 }, oilJob, 0) === null)
  check(
    'eine Position ohne Material und ohne Arbeit ergibt nichts',
    positionPriceCheck({ priceEur: 50 }, { laborHours: 0, partsMinEur: 0, partsMaxEur: 0 }, 110) === null,
  )
  const nurArbeit = positionPriceCheck({ priceEur: 160 }, { laborHours: 1.5, partsMinEur: 0, partsMaxEur: 0 }, 110)
  check('reine Arbeitsposition wird eingeordnet', nurArbeit.usualMin === 165 && nurArbeit.verdict === 'im Rahmen')
  check('Anzeige sagt „ohne Material"', nurArbeit.formula.startsWith('ohne Material'), nurArbeit.formula)
}

console.log('Deckt die Erklärung die ganze Rechnung ab?')
{
  const zeilen = [{ priceEur: 120 }, { priceEur: 80 }, { priceEur: 40 }]
  check('Summe der Zeilen', sumOfPositions(zeilen) === 240)
  check('Netto-Zeilen unter Brutto-Endsumme gelten als vollständig', coversTotal(zeilen, 285))
  check('Fehlt die halbe Rechnung, fällt es auf', !coversTotal(zeilen, 600))
  check('Ohne Endsumme keine Warnung', coversTotal(zeilen, undefined))
  check('Ohne Beträge keine Warnung', coversTotal([{}, {}], 400))
}

console.log('Bereinigung der KI-Antwort')
{
  const roh = {
    readable: true,
    summary: '  Inspektion mit Ölwechsel.  ',
    totalGrossEur: 412.55,
    mileage: 91240,
    positions: [
      { label: 'Ölservice', plain: 'Öl und Ölfilter erneuert', kind: 'Wartung', jobId: 'oil-service', priceEur: 165 },
      { label: 'Erfundene Position', plain: 'x', kind: 'Wartung', jobId: 'gibt-es-nicht' },
      { label: '', plain: 'ohne Bezeichnung', kind: 'Material' },
      { label: 'ohne Erklärung', plain: '   ', kind: 'Material' },
      { label: 'Kleinteile', plain: 'Schrauben und Dichtungen', kind: 'Quatsch', priceEur: 999999 },
    ],
    questions: ['Wurde der Dichtring erneuert?', '  '],
    maintenanceKinds: ['oil', 'nicht-existent'],
  }
  const c = sanitizeInvoice(roh, ['oil-service', 'brake-pads-front'])
  check('Zeilen ohne Text fliegen raus', c.positions.length === 3, `${c.positions.length}`)
  check('gültige jobId bleibt', c.positions[0].jobId === 'oil-service')
  check('erfundene jobId fliegt raus', c.positions[1].jobId === undefined)
  check('unbekannte Art wird zu „Sonstiges"', c.positions[2].kind === 'Sonstiges', c.positions[2].kind)
  check('unmöglicher Betrag fliegt raus', c.positions[2].priceEur === undefined)
  check('leere Frage fliegt raus', c.questions.length === 1)
  check('unbekannte Wartungsart fliegt raus', c.maintenanceKinds.length === 1)
  check('Zusammenfassung ohne Leerraum', c.summary === 'Inspektion mit Ölwechsel.')

  const leer = sanitizeInvoice({ readable: true, summary: 'x', positions: [] }, [])
  check('ohne erkennbare Zeilen gilt der Beleg als unlesbar', leer.readable === false)
}

console.log('Von der Rechnungszeile zum Bauteil')
{
  const golf = vehicle()
  const faelle = [
    ['Bremsscheibe', 'Bremsscheiben vorne ersetzt', 'brake-disc'],
    ['Zündkerze', 'Zündkerzen erneuert', undefined],
    ['Innenraumfilter', 'Pollenfilter gewechselt', 'cabin-filter'],
    ['Starterbatterie', 'Batterie erneuert und angelernt', 'battery'],
    [undefined, 'Arbeitslohn', undefined],
    [undefined, 'Altölentsorgung', undefined],
  ]
  for (const [hint, label, erwartet] of faelle) {
    const treffer = findHotspotId([hint, label].filter(Boolean).join(' '), golf)
    check(`"${label}" → ${erwartet ?? 'kein Sprung'}`, treffer === erwartet, `gefunden: ${treffer ?? 'nichts'}`)
  }

  const eAuto = vehicle({ fuel: 'Elektro', make: 'Tesla', model: 'Model 3' })
  check('E-Auto springt nicht zum Ölfilter', findHotspotId('Ölfilter Ölservice', eAuto) === undefined)
  const eJobs = repairJobsFor(eAuto)
  check('dem E-Auto wird kein Ölservice zum Vergleich angeboten', !eJobs.some((j) => j.id === 'oil-service'))
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – Preis-Einordnung, Vollständigkeit und Bereinigung stimmen.')
