/**
 * Prüfstand für die Rechenkerne gegen echte Referenzwerte.
 *
 * Die Kfz-Steuer ist der einzige Wert in der App, der gesetzlich exakt sein muss –
 * alles andere ist als Schätzung gekennzeichnet. Deshalb steht sie hier im
 * Mittelpunkt, mit von Hand nachgerechneten Fällen nach § 9 KraftStG.
 *
 * Aufruf: npm run test:calc
 */
import { calculateCosts, calculateTax } from '../src/lib/costs.ts'
import { valuate } from '../src/lib/valuation.ts'

const problems = []
const eur = (n) => `${n.toFixed(2).replace('.', ',')} €`

function car(patch = {}) {
  return {
    id: 't',
    kind: 'car',
    make: 'BMW',
    model: '320d',
    year: 2019,
    mileage: 90_000,
    mileageUpdatedAt: new Date().toISOString(),
    fuel: 'Diesel',
    transmission: 'Schaltgetriebe',
    powerKw: 140,
    condition: 'gut',
    createdAt: new Date().toISOString(),
    ...patch,
  }
}

/**
 * Von Hand nach § 9 KraftStG gerechnet.
 * Hubraum: je angefangene 100 cm³ – 2,00 € (Benzin) bzw. 9,50 € (Diesel).
 * CO2 ab Erstzulassung 2021: gestaffelt ueber 95 g/km.
 */
const TAX_CASES = [
  {
    name: 'BMW 320d – Referenz aus CLAUDE.md (~250 €)',
    vehicle: car({ displacementCcm: 1995, co2GramPerKm: 124, firstRegistration: '2021-03-01' }),
    // 20 x 9,50 = 190 | CO2: (115-95) x 2,00 + (124-115) x 2,20 = 40 + 19,80
    expect: 249.8,
  },
  {
    name: 'VW Golf 1.4 TSI – Referenz aus CLAUDE.md (~79 €)',
    vehicle: car({
      make: 'Volkswagen', model: 'Golf', fuel: 'Benzin',
      displacementCcm: 1395, co2GramPerKm: 120, firstRegistration: '2021-05-01',
    }),
    // 14 x 2,00 = 28 | CO2: 20 x 2,00 + 5 x 2,20 = 40 + 11
    expect: 79,
  },
  {
    name: 'Unter dem CO2-Freibetrag – nur Hubraum',
    vehicle: car({
      make: 'Toyota', model: 'Yaris', fuel: 'Benzin',
      displacementCcm: 1490, co2GramPerKm: 92, firstRegistration: '2022-01-01',
    }),
    expect: 30, // 15 x 2,00
  },
  {
    name: 'Hohe Emission – oberste Staffel greift',
    vehicle: car({
      make: 'Porsche', model: 'Cayenne', fuel: 'Benzin',
      displacementCcm: 2995, co2GramPerKm: 250, firstRegistration: '2022-01-01',
    }),
    // 30 x 2,00 = 60 | 20x2,0 + 20x2,2 + 20x2,5 + 20x2,9 + 20x3,4 + 55x4,2
    expect: 60 + 40 + 44 + 50 + 58 + 68 + 231,
  },
  {
    name: 'Motorrad – 1,84 € je angefangene 25 cm³, kein CO2-Anteil',
    vehicle: car({ kind: 'motorcycle', make: 'Honda', model: 'CB 650 R', fuel: 'Benzin', displacementCcm: 649 }),
    expect: Math.ceil(649 / 25) * 1.84, // 26 x 1,84 = 47,84
  },
  {
    name: 'Elektro – befreit',
    vehicle: car({ fuel: 'Elektro', displacementCcm: undefined, co2GramPerKm: 0 }),
    expect: 0,
  },
]

console.log('Kfz-Steuer')
for (const c of TAX_CASES) {
  const got = calculateTax(c.vehicle).yearlyEur
  const ok = Math.abs(got - c.expect) < 0.01
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${c.name}: ${eur(got)}${ok ? '' : ` – erwartet ${eur(c.expect)}`}`)
  if (!ok) problems.push(`${c.name}: ${eur(got)} statt ${eur(c.expect)}`)
}

/**
 * Der CO2-Anteil richtet sich nach der Fassung des Gesetzes zur Erstzulassung.
 * Freibetrag und Satz wurden mehrfach geaendert – fuer ein Fahrzeug gilt immer
 * das Recht seiner Erstzulassung, nicht das heutige.
 */
console.log('\nErstzulassung entscheidet über den CO₂-Satz')
const OLD_CASES = [
  {
    name: 'EZ 2018 – linear 2,00 €/g, Freibetrag 95',
    vehicle: car({
      make: 'Volkswagen', model: 'Golf GTI', fuel: 'Benzin',
      displacementCcm: 1984, co2GramPerKm: 200, firstRegistration: '2018-06-01', year: 2018,
    }),
    expect: 20 * 2.0 + (200 - 95) * 2.0, // 40 + 210 = 250
  },
  {
    name: 'EZ 2019 – linear, kleiner Ausstoß',
    vehicle: car({ displacementCcm: 1995, co2GramPerKm: 124, firstRegistration: '2019-04-01' }),
    expect: 190 + (124 - 95) * 2.0, // 190 + 58 = 248
  },
  {
    name: 'EZ 2013 – Freibetrag 110 g/km',
    vehicle: car({
      make: 'Ford', model: 'Focus', fuel: 'Benzin', year: 2013,
      displacementCcm: 1596, co2GramPerKm: 130, firstRegistration: '2013-03-01',
    }),
    expect: 16 * 2.0 + (130 - 110) * 2.0, // 32 + 40 = 72
  },
  {
    name: 'EZ 2010 – Freibetrag 120 g/km',
    vehicle: car({
      make: 'Opel', model: 'Astra', fuel: 'Benzin', year: 2010,
      displacementCcm: 1598, co2GramPerKm: 140, firstRegistration: '2010-09-01',
    }),
    expect: 16 * 2.0 + (140 - 120) * 2.0, // 32 + 40 = 72
  },
  {
    name: 'EZ 2022 – Staffelung greift weiterhin',
    vehicle: car({
      make: 'Volkswagen', model: 'Golf GTI', fuel: 'Benzin', year: 2022,
      displacementCcm: 1984, co2GramPerKm: 200, firstRegistration: '2022-06-01',
    }),
    // 40 | 20x2,0 + 20x2,2 + 20x2,5 + 20x2,9 + 20x3,4 + 5x4,2
    expect: 40 + 40 + 44 + 50 + 58 + 68 + 21,
  },
  {
    name: 'Ohne Erstzulassungsdatum zählt das Baujahr',
    vehicle: car({
      make: 'Volkswagen', model: 'Golf GTI', fuel: 'Benzin', year: 2018,
      displacementCcm: 1984, co2GramPerKm: 200, firstRegistration: undefined,
    }),
    expect: 250,
  },
]
for (const c of OLD_CASES) {
  const got = calculateTax(c.vehicle).yearlyEur
  const ok = Math.abs(got - c.expect) < 0.01
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${c.name}: ${eur(got)}${ok ? '' : ` – nach Gesetz ${eur(c.expect)}, Abweichung ${eur(got - c.expect)}`}`)
  if (!ok) problems.push(`${c.name}: ${eur(got)} statt ${eur(c.expect)}`)
}

/** Vor dem 01.07.2009 galt die Besteuerung nach Schadstoffklasse – die kennt die App nicht */
console.log('\nAltes Recht wird als solches erkannt')
const PRE_2009 = [
  { name: 'EZ 2005 – Hubraum und Schadstoffklasse', vehicle: car({ fuel: 'Benzin', year: 2005, displacementCcm: 1600, co2GramPerKm: 180, firstRegistration: '2005-04-01' }) },
  { name: 'EZ Mai 2009 – noch altes Recht', vehicle: car({ fuel: 'Benzin', year: 2009, displacementCcm: 1600, co2GramPerKm: 180, firstRegistration: '2009-05-01' }) },
]
for (const c of PRE_2009) {
  const res = calculateTax(c.vehicle)
  const ok = !!res.missing && res.yearlyEur === 0
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${c.name}: ${ok ? 'Hinweis statt erfundener Zahl' : `${eur(res.yearlyEur)} berechnet`}`)
  if (!ok) problems.push(`${c.name}: rechnet nach neuem Recht statt zu melden`)
}

/** Plausibilitaet statt exakter Werte – die Wertschaetzung ist offen als Schaetzung gekennzeichnet */
console.log('\nMarktwert – Plausibilität')
const VALUE_CASES = [
  { name: 'Neuwagen verliert im ersten Jahr spuerbar', v: car({ year: new Date().getFullYear(), mileage: 5_000, listPriceNew: 40_000 }), min: 26_000, max: 40_000 },
  { name: 'Zehn Jahre alt, hohe Laufleistung', v: car({ year: new Date().getFullYear() - 10, mileage: 220_000, listPriceNew: 40_000 }), min: 1_500, max: 12_000 },
  { name: 'Wert faellt nie unter null', v: car({ year: 1990, mileage: 500_000, listPriceNew: 40_000 }), min: 0, max: 8_000 },
]
for (const c of VALUE_CASES) {
  const got = valuate(c.v).privateSale
  const ok = got >= c.min && got <= c.max
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${c.name}: ${eur(got)}${ok ? '' : ` – erwartet zwischen ${eur(c.min)} und ${eur(c.max)}`}`)
  if (!ok) problems.push(`${c.name}: ${eur(got)}`)
}

/** Die Gesamtkosten muessen in sich stimmen – die Summe ist nachrechenbar */
console.log('\nGesamtkosten – innere Stimmigkeit')
const costs = calculateCosts(car({ displacementCcm: 1995, co2GramPerKm: 124, annualKm: 15_000, firstRegistration: '2021-03-01' }))
const summe = costs.depreciation + costs.tax + costs.insurance + costs.fuel + costs.maintenance
const checks = [
  ['Summe entspricht den Einzelposten', Math.abs(summe - costs.totalYear) <= 1],
  ['Monat ist ein Zwoelftel des Jahres', Math.abs(costs.totalMonth - costs.totalYear / 12) <= 1],
  ['Kosten pro km passen zur Fahrleistung', Math.abs(costs.perKm - costs.totalYear / costs.annualKm) <= 0.01],
  ['Diesel wird in Litern gerechnet', costs.fuelUnit === 'l'],
  ['Ohne Belege ist die Wartung geschaetzt', costs.maintenanceFromRecords === false],
]
for (const [name, ok] of checks) {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}`)
  if (!ok) problems.push(name)
}

if (problems.length) {
  console.log(`\nPROBLEME (${problems.length}):`)
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – alle Rechenkerne stimmen.')
