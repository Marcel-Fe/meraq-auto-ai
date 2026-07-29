import type { Condition, Vehicle } from '../types'

/**
 * Transparente Wertschätzung.
 *
 * WICHTIG: Das ist bewusst eine offengelegte Rechnung, KEINE Marktabfrage.
 * Echte Marktwerte (DAT/Schwacke) erfordern kostenpflichtige Datenverträge.
 * Jeder Faktor unten ist im UI sichtbar, damit die Zahl nachvollziehbar bleibt
 * und nicht wie eine erfundene Präzisionsangabe wirkt.
 *
 * Modell: Wert = Neupreis × Altersfaktor × Laufleistungsfaktor × Zustandsfaktor × Antriebsfaktor
 */

export interface ValuationFactor {
  label: string
  detail: string
  factor: number
}

export interface Valuation {
  basePriceNew: number
  factors: ValuationFactor[]
  /** Referenzwert = Privatverkauf */
  privateSale: number
  dealerPurchase: number
  dealerSale: number
  exportValue: number
  /** Restwert in drei Jahren */
  residualIn3Years: number
  rangeMin: number
  rangeMax: number
  ageYears: number
  kmPerYear: number
}

const CONDITION_FACTOR: Record<Condition, number> = {
  'sehr gut': 1.08,
  gut: 1.0,
  befriedigend: 0.88,
  reparaturbedürftig: 0.68,
}

/** Erwartete Jahresfahrleistung als Referenz für die km-Korrektur */
export const REFERENCE_KM_PER_YEAR = 15_000

/** Grober Neupreis, falls der Nutzer keinen gepflegt hat */
export function estimateListPrice(v: Vehicle): number {
  if (v.listPriceNew && v.listPriceNew > 0) return v.listPriceNew
  const byKind: Record<Vehicle['kind'], number> = {
    car: 260,
    motorcycle: 120,
    van: 300,
    truck: 500,
    bus: 480,
    camper: 420,
  }
  // Neupreis grob über die Leistung: Euro pro kW, je Fahrzeugart
  const base = byKind[v.kind] * Math.max(v.powerKw, 40)
  return Math.round(base / 500) * 500
}

/** Degressive Wertentwicklung: ~18 % im ersten Jahr, danach ~11 % p. a., Boden bei 12 % */
function ageFactor(ageYears: number): number {
  if (ageYears <= 0) return 1
  const first = 0.82
  const rest = Math.pow(0.89, Math.max(0, ageYears - 1))
  return Math.max(0.12, first * rest)
}

/** Abweichung von der erwarteten Laufleistung: ±0,8 % je 1.000 km */
function mileageFactor(mileage: number, ageYears: number): number {
  const expected = Math.max(REFERENCE_KM_PER_YEAR * Math.max(ageYears, 0.5), 5_000)
  const deltaK = (expected - mileage) / 1000
  return Math.min(1.18, Math.max(0.62, 1 + deltaK * 0.008))
}

/** Nachfrage-Korrektur nach Antriebsart (Stand: allgemeine Marktbeobachtung, kein Live-Feed) */
function fuelFactor(v: Vehicle): number {
  switch (v.fuel) {
    case 'Elektro':
      return 0.9
    case 'Diesel':
      return 0.96
    case 'Hybrid':
    case 'Plug-in-Hybrid':
      return 1.04
    default:
      return 1
  }
}

export function valuate(v: Vehicle, at: Date = new Date()): Valuation {
  const basePriceNew = estimateListPrice(v)
  const ageYears = Math.max(0, at.getFullYear() + at.getMonth() / 12 - v.year)
  const kmPerYear = Math.round(v.mileage / Math.max(ageYears, 0.5))

  const fAge = ageFactor(ageYears)
  const fKm = mileageFactor(v.mileage, ageYears)
  const fCond = CONDITION_FACTOR[v.condition] ?? 1
  const fFuel = fuelFactor(v)

  const privateSale = Math.round((basePriceNew * fAge * fKm * fCond * fFuel) / 50) * 50

  const factors: ValuationFactor[] = [
    {
      label: 'Alter',
      detail: `${ageYears.toFixed(1)} Jahre seit Baujahr ${v.year}`,
      factor: fAge,
    },
    {
      label: 'Laufleistung',
      detail: `${kmPerYear.toLocaleString('de-DE')} km/Jahr statt ${REFERENCE_KM_PER_YEAR.toLocaleString('de-DE')} km`,
      factor: fKm,
    },
    { label: 'Zustand', detail: v.condition, factor: fCond },
    { label: 'Antrieb', detail: `${v.fuel} – Nachfrage am Markt`, factor: fFuel },
  ]

  const residualVehicle: Vehicle = {
    ...v,
    year: v.year,
    mileage: v.mileage + REFERENCE_KM_PER_YEAR * 3,
  }
  const at3 = new Date(at)
  at3.setFullYear(at3.getFullYear() + 3)

  return {
    basePriceNew,
    factors,
    privateSale,
    // Händler kauft unter, verkauft über Privatniveau; Export liegt darunter
    dealerPurchase: Math.round((privateSale * 0.86) / 50) * 50,
    dealerSale: Math.round((privateSale * 1.14) / 50) * 50,
    exportValue: Math.round((privateSale * 0.79) / 50) * 50,
    residualIn3Years: valuateSimple(residualVehicle, at3),
    rangeMin: Math.round((privateSale * 0.93) / 50) * 50,
    rangeMax: Math.round((privateSale * 1.07) / 50) * 50,
    ageYears,
    kmPerYear,
  }
}

/** Nur der Privatwert – ohne Rekursion, für Restwert-Projektionen */
function valuateSimple(v: Vehicle, at: Date): number {
  const basePriceNew = estimateListPrice(v)
  const ageYears = Math.max(0, at.getFullYear() + at.getMonth() / 12 - v.year)
  const value =
    basePriceNew *
    ageFactor(ageYears) *
    mileageFactor(v.mileage, ageYears) *
    (CONDITION_FACTOR[v.condition] ?? 1) *
    fuelFactor(v)
  return Math.round(value / 50) * 50
}

/**
 * Wertverlauf der letzten N Monate – rückgerechnet aus derselben Formel.
 * Kein Marktdaten-Feed, sondern die Kurve, die unser Modell für die
 * Vergangenheit ergibt (weniger km, geringeres Alter).
 */
export function valueHistory(v: Vehicle, months: number): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = []
  const kmPerMonth = v.mileage / Math.max(monthsSince(v.year), 1)
  const now = new Date()

  for (let i = months; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const pastVehicle: Vehicle = { ...v, mileage: Math.max(0, v.mileage - kmPerMonth * i) }
    out.push({ date: d.toISOString(), value: valuateSimple(pastVehicle, d) })
  }
  return out
}

function monthsSince(year: number) {
  const now = new Date()
  return (now.getFullYear() - year) * 12 + now.getMonth() + 1
}
