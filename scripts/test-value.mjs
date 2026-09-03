/**
 * Prüft die reine Logik hinter „Was ist mein Auto noch wert – und was ist die
 * Untergrenze?": die Zu- und Abschläge aus dem wirklichen Zustand, die
 * Preisuntergrenze und den Verkaufs-Check.
 *
 * Hier steht eine Zahl neben einer Verhandlung. Wer glaubt, sein Auto sei
 * 2.000 € mehr wert, verkauft es nicht – wer es zu niedrig ansetzt, verschenkt
 * Geld. Deshalb ohne Netz und ohne KI prüfbar.
 *
 * Die erwarteten Werte werden nicht hart eingetragen, sondern aus `valuate()`
 * abgeleitet: Der Marktwert hängt am heutigen Datum, eine feste Zahl wäre nach
 * einem Monatswechsel falsch.
 *
 * Aufruf: npm run test:value
 */
import { sellingChecklist, sellingFloor, valueAdjustments } from '../src/lib/sellingPrice.ts'
import { valuate } from '../src/lib/valuation.ts'
import { repairJobsFor } from '../src/data/parts.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

const NOW = new Date()
const daysFromNow = (days) => new Date(NOW.getTime() + days * 86_400_000).toISOString()
const monthsAgo = (months) => daysFromNow(-Math.round(months * 30.44))

const vehicle = (patch = {}) => ({
  id: 'v1',
  kind: 'car',
  make: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  mileage: 90000,
  mileageUpdatedAt: NOW.toISOString(),
  fuel: 'Benzin',
  transmission: 'Schaltgetriebe',
  powerKw: 110,
  condition: 'gut',
  createdAt: monthsAgo(12),
  ...patch,
})

const item = (patch = {}) => ({
  id: 'm1',
  vehicleId: 'v1',
  kind: 'oil',
  label: 'Ölwechsel',
  intervalKm: 15000,
  intervalMonths: 12,
  ...patch,
})

/** Eine Position, die eindeutig überfällig ist – 5.000 km und 8 Monate darüber */
const overdue = (patch = {}) =>
  item({ lastDoneKm: 70000, lastDoneAt: monthsAgo(20), ...patch })

/** Nur zeitbasiert und deutlich darüber – für Positionen ohne km-Intervall */
const overdueByTime = (patch = {}) =>
  item({ intervalKm: 0, intervalMonths: 24, lastDoneAt: monthsAgo(30), ...patch })

/** Frisch erledigt: 1.000 km und einen Monat her */
const fresh = (patch = {}) => item({ lastDoneKm: 89000, lastDoneAt: monthsAgo(1), ...patch })

const RATE = 110
const golf = vehicle()
const golfJobs = repairJobsFor(golf)
const golfValuation = valuate(golf)
const BASE = golfValuation.privateSale

console.log(`Basis: Privatwert ${BASE} €, Händler-Ankauf ${golfValuation.dealerPurchase} €`)

console.log('\nOhne Kontext bleibt alles wie vorher')
{
  check('keine Zu- und Abschläge', valueAdjustments(golf).length === 0)
  const f = sellingFloor(golf)
  check('Wert unverändert', f.adjustedPrivate === BASE, `${f.adjustedPrivate}`)
  check('Summe der Anpassungen ist null', f.adjustmentsTotal === 0)
  check(
    'Untergrenze ist der Händler-Ankauf',
    f.floor === golfValuation.dealerPurchase,
    `${f.floor} statt ${golfValuation.dealerPurchase}`,
  )
  check('Startpreis liegt über dem Wert', f.askingPrice > f.adjustedPrivate, `${f.askingPrice}`)
  check('Untergrenze liegt unter dem Wert', f.floor < f.adjustedPrivate)
  check('nicht gedeckelt', f.capped === false)
  check('Satz nennt die Untergrenze', f.sentence.includes(f.floor.toLocaleString('de-DE')), f.sentence)
}

console.log('\nÜberfällige Wartung wird zur Nachholrechnung')
{
  const adj = valueAdjustments(golf, {
    maintenance: [overdue()],
    jobs: golfJobs,
    hourlyRateEur: RATE,
    valuation: golfValuation,
  })
  const job = golfJobs.find((j) => j.id === 'oil-service')
  const erwartet = Math.round(job.partsMinEur) + Math.round(job.laborHours * RATE)

  check('genau ein Posten', adj.length === 1, `${adj.length}`)
  check('Betrag = Teile ab + Arbeitszeit', adj[0]?.amountEur === -erwartet, `${adj[0]?.amountEur} statt ${-erwartet}`)
  check('Abschlag, kein Aufschlag', adj[0]?.amountEur < 0)
  check('Rechnung offengelegt', adj[0]?.formula.includes(`${RATE} €/h`), adj[0]?.formula)
  check('Begründung vorhanden', (adj[0]?.reason ?? '').length > 20, adj[0]?.reason)
}

console.log('\nOhne Grundlage kein Betrag')
{
  const ohneSatz = valueAdjustments(golf, {
    maintenance: [overdue()],
    jobs: golfJobs,
    valuation: golfValuation,
  })
  check('ohne Stundensatz kein Posten', ohneSatz.length === 0, `${ohneSatz.length}`)

  const ohneJobs = valueAdjustments(golf, {
    maintenance: [overdue()],
    hourlyRateEur: RATE,
    valuation: golfValuation,
  })
  check('ohne Werkstattpositionen kein Posten', ohneJobs.length === 0)

  const nichtFaellig = valueAdjustments(golf, {
    maintenance: [fresh()],
    jobs: golfJobs,
    hourlyRateEur: RATE,
    valuation: golfValuation,
  })
  check('was nicht überfällig ist, zählt nicht', nichtFaellig.length === 0)

  const reifen = valueAdjustments(golf, {
    maintenance: [overdue({ id: 'm-reifen', kind: 'tires', label: 'Reifen prüfen' })],
    jobs: golfJobs,
    hourlyRateEur: RATE,
    valuation: golfValuation,
  })
  check('ohne passende Werkstattposition keine geratene Zahl', reifen.length === 0, `${reifen.length}`)
}

console.log('\nFahrzeugunabhängigkeit')
{
  const eAuto = vehicle({ make: 'Tesla', model: 'Model 3', fuel: 'Elektro', powerKw: 208 })
  const eJobs = repairJobsFor(eAuto)
  const adj = valueAdjustments(eAuto, {
    // So etwas kann im Plan eines E-Autos nicht stehen – käme es doch dazu,
    // darf daraus kein Abschlag werden
    maintenance: [
      overdue({ id: 'e1', kind: 'oil', label: 'Ölwechsel' }),
      overdue({ id: 'e2', kind: 'timing-belt', label: 'Zahnriemen' }),
      overdue({ id: 'e3', kind: 'spark-plugs', label: 'Zündkerzen' }),
    ],
    jobs: eJobs,
    hourlyRateEur: RATE,
  })
  check('E-Auto bekommt keinen Öl-, Zahnriemen- oder Kerzen-Abschlag', adj.length === 0, JSON.stringify(adj.map((a) => a.label)))

  const eHv = valueAdjustments(eAuto, {
    maintenance: [overdueByTime({ id: 'e4', kind: 'hv-battery', label: 'Hochvoltbatterie prüfen' })],
    jobs: eJobs,
    hourlyRateEur: RATE,
  })
  check('die Hochvoltprüfung zählt dagegen schon', eHv.length === 1, `${eHv.length}`)

  const bike = vehicle({ kind: 'motorcycle', make: 'Honda', model: 'CB 650 R', powerKw: 70 })
  const bikeAdj = valueAdjustments(bike, {
    maintenance: [overdue({ id: 'b1', kind: 'chain', label: 'Antriebskette', intervalKm: 1000, intervalMonths: 1 })],
    jobs: repairJobsFor(bike),
    hourlyRateEur: RATE,
  })
  check('Motorrad bekommt den Kettenkit-Abschlag', bikeAdj.length === 1 && bikeAdj[0].amountEur < 0)

  const bikeHu = valueAdjustments(bike)
  check('Motorrad ohne HU-Termin bekommt keinen HU-Posten', bikeHu.length === 0)

  const bikeAbgelaufen = valueAdjustments(vehicle({ kind: 'motorcycle', make: 'Honda', model: 'CB 650 R', powerKw: 70, huDue: daysFromNow(-40) }))
  const bikeFee = bikeAbgelaufen.find((a) => a.id === 'hu-expired')
  const carAbgelaufen = valueAdjustments(vehicle({ huDue: daysFromNow(-40) }))
  const carFee = carAbgelaufen.find((a) => a.id === 'hu-expired')
  check(
    'die HU-Gebühr eines Motorrads liegt unter der eines Pkw',
    Math.abs(bikeFee.amountEur) < Math.abs(carFee.amountEur),
    `${bikeFee.amountEur} / ${carFee.amountEur}`,
  )
}

console.log('\nOffene Fehlercodes')
{
  const dtc = (patch) => ({ id: 'd1', vehicleId: 'v1', date: monthsAgo(1), code: 'P0301', title: 'Zündaussetzer Zylinder 1', severity: 'warn', system: 'Motor', resolved: false, ...patch })

  const adj = valueAdjustments(golf, { diagnoses: [dtc({ severity: 'critical' })], valuation: golfValuation })
  check('schwerwiegender Code = 6 % des Werts', adj[0]?.amountEur === -Math.round(BASE * 0.06), `${adj[0]?.amountEur}`)
  check('Prozentsatz steht in der Rechnung', adj[0]?.formula.includes('6 %'), adj[0]?.formula)

  const leicht = valueAdjustments(golf, { diagnoses: [dtc({ severity: 'info' })], valuation: golfValuation })
  check('Hinweis wiegt leichter als ein schwerer Fehler', Math.abs(leicht[0].amountEur) < Math.abs(adj[0].amountEur))

  const erledigt = valueAdjustments(golf, { diagnoses: [dtc({ resolved: true })], valuation: golfValuation })
  check('erledigte Codes zählen nicht', erledigt.length === 0)

  const zwei = valueAdjustments(golf, {
    diagnoses: [dtc({ id: 'd1' }), dtc({ id: 'd2', code: 'P0420' })],
    valuation: golfValuation,
  })
  check('zwei offene Codes = zwei Posten', zwei.length === 2, `${zwei.length}`)
}

console.log('\nHauptuntersuchung')
{
  const abgelaufen = valueAdjustments(vehicle({ huDue: daysFromNow(-60) }), { valuation: golfValuation })
  const bald = valueAdjustments(vehicle({ huDue: daysFromNow(30) }), { valuation: golfValuation })
  const frisch = valueAdjustments(vehicle({ huDue: daysFromNow(700) }), { valuation: golfValuation })
  const mittig = valueAdjustments(vehicle({ huDue: daysFromNow(300) }), { valuation: golfValuation })

  check('abgelaufene HU kostet Gebühr plus Risiko', abgelaufen[0]?.amountEur === -(145 + Math.round(BASE * 0.02)), `${abgelaufen[0]?.amountEur}`)
  check('bald fällige HU kostet die Gebühr', bald[0]?.amountEur === -145, `${bald[0]?.amountEur}`)
  check('frische HU ist ein Aufschlag', frisch[0]?.amountEur === 145, `${frisch[0]?.amountEur}`)
  check('dazwischen passiert nichts', mittig.length === 0, `${mittig.length}`)
  check('ohne HU-Termin kein Posten', valueAdjustments(golf, { valuation: golfValuation }).length === 0)
}

console.log('\nBelegte Wartung')
{
  const beleg = (id, cost, months) => ({ id, vehicleId: 'v1', date: monthsAgo(months), title: 'Inspektion', icon: 'invoice', costEur: cost })

  const adj = valueAdjustments(golf, {
    activities: [beleg('a1', 400, 3), beleg('a2', 600, 14)],
    valuation: golfValuation,
  })
  check('zwei Belege ergeben einen Aufschlag', adj.length === 1 && adj[0].amountEur > 0, JSON.stringify(adj))
  check(
    'Aufschlag = 20 % der Belegsumme, gedeckelt',
    adj[0].amountEur === Math.round(Math.min(1000 * 0.2, BASE * 0.04)),
    `${adj[0].amountEur}`,
  )

  const einer = valueAdjustments(golf, { activities: [beleg('a1', 400, 3)], valuation: golfValuation })
  check('ein einzelner Beleg ist noch keine Historie', einer.length === 0)

  const alt = valueAdjustments(golf, {
    activities: [beleg('a1', 400, 30), beleg('a2', 600, 40)],
    valuation: golfValuation,
  })
  check('Belege älter als zwei Jahre zählen nicht', alt.length === 0)

  const gedeckelt = valueAdjustments(golf, {
    activities: [beleg('a1', 9000, 3), beleg('a2', 9000, 6)],
    valuation: golfValuation,
  })
  check('der Deckel greift bei 4 % des Werts', gedeckelt[0].amountEur === Math.round(BASE * 0.04), `${gedeckelt[0].amountEur}`)

  const nurPapier = valueAdjustments(golf, {
    documents: [
      { id: 'x1', vehicleId: 'v1', title: 'Rechnung', category: 'Rechnung', date: monthsAgo(4) },
      { id: 'x2', vehicleId: 'v1', title: 'Serviceheft', category: 'Serviceheft', date: monthsAgo(9) },
    ],
    valuation: golfValuation,
  })
  check('Dokumente ohne Beträge bringen weniger', nurPapier[0]?.amountEur === Math.round(BASE * 0.02), `${nurPapier[0]?.amountEur}`)
}

console.log('\nDie Untergrenze')
{
  const kaputt = vehicle({ huDue: daysFromNow(-90) })
  const f = sellingFloor(kaputt, {
    maintenance: [overdue(), overdueByTime({ id: 'm2', kind: 'brake-fluid', label: 'Bremsflüssigkeit' })],
    diagnoses: [
      { id: 'd1', vehicleId: 'v1', date: monthsAgo(1), code: 'P0301', title: 'Zündaussetzer', severity: 'critical', system: 'Motor', resolved: false },
    ],
    jobs: golfJobs,
    hourlyRateEur: RATE,
  })

  check('mehrere Abschläge summieren sich', f.adjustmentsTotal < 0 && f.adjustments.length >= 3, JSON.stringify(f.adjustments.map((a) => a.amountEur)))
  check('Wert sinkt gegenüber dem Papierwert', f.adjustedPrivate < f.basePrivate)
  check('Untergrenze folgt dem gesenkten Wert', f.floor < golfValuation.dealerPurchase)
  check('Untergrenze bleibt unter dem Verkaufswert', f.floor < f.adjustedPrivate)
  check('Startpreis liegt über dem Verkaufswert', f.askingPrice > f.adjustedPrivate)
  check('Rechnung nennt beide Schritte', f.formula.includes('Zu-/Abschläge') && f.formula.includes('Händler-Ankauf'), f.formula)
  check('alle Beträge auf 50 € gerundet', [f.adjustedPrivate, f.floor, f.askingPrice].every((v) => v % 50 === 0))
}

console.log('\nDer Deckel nach unten')
{
  const codes = Array.from({ length: 12 }, (_, i) => ({
    id: `d${i}`,
    vehicleId: 'v1',
    date: monthsAgo(1),
    code: `P03${i}0`,
    title: 'Zündaussetzer',
    severity: 'critical',
    system: 'Motor',
    resolved: false,
  }))
  const f = sellingFloor(golf, { diagnoses: codes, valuation: golfValuation })
  check('zwölf schwere Codes machen das Auto nicht wertlos', f.adjustedPrivate >= Math.round(BASE * 0.45) - 50, `${f.adjustedPrivate}`)
  check('die Begrenzung wird gemeldet', f.capped === true)
  check('jeder Posten bleibt einzeln sichtbar', f.adjustments.length === 12)
}

console.log('\nDer Deckel nach oben')
{
  const f = sellingFloor(vehicle({ huDue: daysFromNow(700) }), {
    activities: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, vehicleId: 'v1', date: monthsAgo(i + 1), title: 'Rechnung', icon: 'invoice', costEur: 5000 })),
    valuation: golfValuation,
  })
  check('gepflegtes Fahrzeug liegt über dem Papierwert', f.adjustedPrivate > BASE, `${f.adjustedPrivate}`)
  check('kein Aufschlag über 8 %', f.adjustedPrivate <= Math.round(BASE * 1.08) + 50, `${f.adjustedPrivate}`)
}

console.log('\nDer Verkaufs-Check')
{
  const liste = sellingChecklist(vehicle({ huDue: daysFromNow(400) }), {
    maintenance: [fresh(), overdueByTime({ id: 'm2', kind: 'brake-fluid', label: 'Bremsflüssigkeit' })],
    activities: [{ id: 'a1', vehicleId: 'v1', date: monthsAgo(3), title: 'Inspektion', icon: 'invoice', costEur: 420 }],
    diagnoses: [{ id: 'd1', vehicleId: 'v1', date: monthsAgo(1), code: 'P0420', title: 'Katalysator', severity: 'warn', system: 'Abgas', resolved: false }],
    documents: [{ id: 'x1', vehicleId: 'v1', title: 'Fahrzeugschein', category: 'Fahrzeugschein', date: monthsAgo(20) }],
  })
  const ids = liste.map((p) => p.id)
  const arten = (kind) => liste.filter((p) => p.kind === kind)

  check('Belege stehen als Beweis drin', ids.includes('proof-receipts'), ids.join(', '))
  check('frisch Erledigtes zählt als Beweis', ids.includes('proof-fresh'))
  check('lange gültige HU zählt als Beweis', ids.includes('proof-hu'))
  check('Papiere zählen als Beweis', ids.includes('proof-papers'))
  check('Überfälliges drückt', ids.includes('drag-m2'))
  check('offene Fehlercodes drücken', ids.includes('drag-dtc'))
  check('fehlender Neupreis wird benannt', ids.includes('missing-price'))
  check('vorhandener Beleg wird nicht als fehlend gemeldet', !ids.includes('missing-receipts'))
  check('alle drei Arten kommen vor', arten('proof').length > 0 && arten('drag').length > 0 && arten('missing').length > 0)

  const leer = sellingChecklist(golf)
  check('ohne Kontext nur die Lücken', leer.every((p) => p.kind === 'missing') && leer.length >= 3, JSON.stringify(leer.map((p) => p.id)))
  check('ohne HU-Termin wird das benannt', leer.some((p) => p.id === 'missing-hu'))
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – Untergrenze, Zu- und Abschläge und der Verkaufs-Check stimmen.')
