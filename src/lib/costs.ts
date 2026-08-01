import type { ActivityEntry, Vehicle } from '../types'
import { valuate } from './valuation'
import { vehicleProfile } from './vehicleProfile'

/**
 * Kfz-Steuer nach dem Kraftfahrzeugsteuergesetz (§ 9 KraftStG).
 *
 * Für Pkw mit Erstzulassung ab 01.07.2009 gilt: Hubraumanteil + CO₂-Anteil.
 * Diese Rechnung ist im Gesetz festgelegt und damit keine Schätzung – vorausgesetzt,
 * Hubraum und CO₂-Wert aus dem Fahrzeugschein sind korrekt eingetragen.
 *
 * Verbindlich ist am Ende der Steuerbescheid des Zolls.
 */
export interface TaxResult {
  yearlyEur: number
  displacementPart: number
  co2Part: number
  exempt: boolean
  /** Warum sich die Steuer nicht berechnen lässt */
  missing?: string
  explanation: string
}

/**
 * Der CO₂-Anteil hängt am Datum der **Erstzulassung**, nicht am heutigen Recht.
 *
 * Freibetrag und Satz wurden mehrfach geändert, und für ein Fahrzeug gilt immer
 * die Fassung seiner Erstzulassung. Die gestaffelten Sätze gelten erst ab
 * 01.01.2021 – davor wird linear mit 2,00 € je g/km gerechnet. Wer das übersieht,
 * rechnet einem älteren Fahrzeug mit hohem CO₂-Wert deutlich zu viel an.
 */
interface Co2Rule {
  freeLimit: number
  /** Gestaffelte Sätze; bei linearer Besteuerung genügt eine Stufe */
  tiers: { upTo: number; rate: number }[]
  label: string
}

const STAGED_TIERS: { upTo: number; rate: number }[] = [
  { upTo: 115, rate: 2.0 },
  { upTo: 135, rate: 2.2 },
  { upTo: 155, rate: 2.5 },
  { upTo: 175, rate: 2.9 },
  { upTo: 195, rate: 3.4 },
  { upTo: Infinity, rate: 4.2 },
]

const LINEAR_TIERS = [{ upTo: Infinity, rate: 2.0 }]

/**
 * Erstzulassung als Jahr und Monat.
 * Fehlt das Datum, dient das Baujahr als Näherung – mit Jahresmitte, damit ein
 * Fahrzeug aus 2009 nicht willkürlich in das eine oder andere System fällt.
 */
function registration(v: Vehicle): { year: number; month: number; exact: boolean } {
  if (v.firstRegistration) {
    const d = new Date(v.firstRegistration)
    if (!Number.isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, exact: true }
    }
  }
  return { year: v.year, month: 7, exact: false }
}

/** Gibt null zurück, wenn das Fahrzeug nach altem Recht (Schadstoffklasse) besteuert wird */
function co2RuleFor(v: Vehicle): Co2Rule | null {
  const { year, month } = registration(v)
  if (year < 2009 || (year === 2009 && month < 7)) return null
  if (year >= 2021) {
    return { freeLimit: 95, tiers: STAGED_TIERS, label: 'gestaffelt nach Höhe des Ausstoßes' }
  }
  if (year >= 2014) return { freeLimit: 95, tiers: LINEAR_TIERS, label: '2,00 € je g/km' }
  if (year >= 2012) return { freeLimit: 110, tiers: LINEAR_TIERS, label: '2,00 € je g/km' }
  return { freeLimit: 120, tiers: LINEAR_TIERS, label: '2,00 € je g/km' }
}

export function calculateTax(v: Vehicle): TaxResult {
  if (v.fuel === 'Elektro') {
    return {
      yearlyEur: 0,
      displacementPart: 0,
      co2Part: 0,
      exempt: true,
      explanation:
        'Reine Elektrofahrzeuge sind von der Kfz-Steuer befreit, wenn sie bis Ende 2025 erstmals zugelassen wurden – längstens bis 31.12.2030. Danach gilt ein ermäßigter Satz nach Gewicht.',
    }
  }

  if (v.kind === 'motorcycle') {
    // Krafträder: 1,84 € je angefangene 25 cm³, kein CO₂-Anteil
    if (!v.displacementCcm) {
      return emptyTax('Für die Steuerberechnung fehlt der Hubraum (Feld P.1 im Fahrzeugschein).')
    }
    const yearly = Math.ceil(v.displacementCcm / 25) * 1.84
    return {
      yearlyEur: round(yearly),
      displacementPart: round(yearly),
      co2Part: 0,
      exempt: false,
      explanation: `Krafträder werden nur nach Hubraum besteuert: 1,84 € je angefangene 25 cm³. Bei ${v.displacementCcm} cm³ sind das ${Math.ceil(v.displacementCcm / 25)} × 1,84 €.`,
    }
  }

  if (v.kind === 'truck' || v.kind === 'bus') {
    return emptyTax(
      'Bei Lkw und Bussen richtet sich die Steuer nach zulässigem Gesamtgewicht und Schadstoffklasse. Diese Angaben erfasst die App noch nicht – der Zoll-Rechner gibt Dir den genauen Betrag.',
    )
  }

  if (!v.displacementCcm) {
    return emptyTax('Für die Steuerberechnung fehlt der Hubraum (Feld P.1 im Fahrzeugschein).')
  }
  if (v.co2GramPerKm == null) {
    return emptyTax('Für die Steuerberechnung fehlt der CO₂-Wert (Feld V.7 im Fahrzeugschein).')
  }

  const rule = co2RuleFor(v)
  if (!rule) {
    return emptyTax(
      'Fahrzeuge mit Erstzulassung vor dem 01.07.2009 werden nach Hubraum und Schadstoffklasse besteuert, nicht nach CO₂. Die Schadstoffklasse erfasst die App nicht – den genauen Betrag nennt der Kfz-Steuer-Rechner des Zolls.',
    )
  }

  // Hubraumanteil: je angefangene 100 cm³
  const perHundred = v.fuel === 'Diesel' ? 9.5 : 2.0
  const units = Math.ceil(v.displacementCcm / 100)
  const displacementPart = units * perHundred

  // CO₂-Anteil: jede Stufe zählt nur für den Anteil in ihrem Bereich
  let co2Part = 0
  let lower = rule.freeLimit
  for (const tier of rule.tiers) {
    if (v.co2GramPerKm <= lower) break
    const upper = Math.min(v.co2GramPerKm, tier.upTo)
    co2Part += (upper - lower) * tier.rate
    lower = tier.upTo
  }

  const yearly = displacementPart + co2Part
  const reg = registration(v)
  const num = (n: number) => n.toFixed(2).replace('.', ',')

  return {
    yearlyEur: round(yearly),
    displacementPart: round(displacementPart),
    co2Part: round(co2Part),
    exempt: false,
    explanation:
      `Hubraum: ${units} × 100 cm³ × ${num(perHundred)} € (${v.fuel}) = ${num(round(displacementPart))} €. ` +
      `CO₂: ${v.co2GramPerKm} g/km, davon sind ${rule.freeLimit} g/km frei, der Rest wird ${rule.label} besteuert = ${num(round(co2Part))} €. ` +
      `Maßgeblich ist die Fassung des Gesetzes zur Erstzulassung (${reg.year})` +
      (reg.exact
        ? '.'
        : ' – hier aus dem Baujahr abgeleitet, weil kein Erstzulassungsdatum hinterlegt ist. Trage es in den Fahrzeugdaten ein, dann wird es genauer.'),
  }
}

function emptyTax(missing: string): TaxResult {
  return {
    yearlyEur: 0,
    displacementPart: 0,
    co2Part: 0,
    exempt: false,
    missing,
    explanation: missing,
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

/* ---------------------------------------------------------------
   Gesamtkosten
   --------------------------------------------------------------- */

export interface CostBreakdown {
  annualKm: number
  /** Wertverlust pro Jahr */
  depreciation: number
  tax: number
  insurance: number
  fuel: number
  maintenance: number
  totalYear: number
  totalMonth: number
  perKm: number
  /** Wurde aus echten Belegen des Nutzers berechnet statt geschätzt? */
  maintenanceFromRecords: boolean
  fuelPricePerUnit: number
  fuelUnit: string
}

/**
 * Durchschnittliche Kraftstoff- und Strompreise in Deutschland (Stand 2026).
 * Bewusst als Konstante mit Datum – so ist sichtbar, dass es kein Live-Preis ist.
 */
export const ENERGY_PRICES = {
  Diesel: { price: 1.72, unit: 'l' },
  Benzin: { price: 1.82, unit: 'l' },
  Elektro: { price: 0.42, unit: 'kWh' },
  Hybrid: { price: 1.82, unit: 'l' },
  'Plug-in-Hybrid': { price: 1.55, unit: 'l' },
  LPG: { price: 1.05, unit: 'l' },
  CNG: { price: 1.45, unit: 'kg' },
} as const

/** Typischer Verbrauch, falls der Nutzer keinen eingetragen hat */
function defaultConsumption(v: Vehicle): number {
  if (v.fuel === 'Elektro') return v.kind === 'motorcycle' ? 8 : 18
  if (v.kind === 'motorcycle') return 4.5
  if (v.kind === 'truck' || v.kind === 'bus') return 28
  if (v.kind === 'camper' || v.kind === 'van') return 9.5
  // Pkw: grob nach Leistung
  return Math.round((5 + v.powerKw / 45) * 10) / 10
}

export function calculateCosts(
  vehicle: Vehicle,
  activities: ActivityEntry[] = [],
): CostBreakdown {
  const annualKm = vehicle.annualKm && vehicle.annualKm > 0 ? vehicle.annualKm : 15_000

  // Wertverlust: Differenz zwischen heutigem Wert und dem Wert in einem Jahr
  const now = valuate(vehicle)
  const inOneYear = valuate(
    { ...vehicle, mileage: vehicle.mileage + annualKm },
    addYear(new Date()),
  )
  const depreciation = Math.max(0, now.privateSale - inOneYear.privateSale)

  const tax = calculateTax(vehicle).yearlyEur

  // Versicherung: eigener Wert, sonst grob nach Fahrzeugwert und Klasse
  const profile = vehicleProfile(vehicle)
  const insurance =
    vehicle.insuranceYearlyEur && vehicle.insuranceYearlyEur > 0
      ? vehicle.insuranceYearlyEur
      : Math.round((380 + now.privateSale * 0.012) * (profile.partsFactor > 1.4 ? 1.25 : 1))

  const consumption = vehicle.consumption && vehicle.consumption > 0 ? vehicle.consumption : defaultConsumption(vehicle)
  const energy = ENERGY_PRICES[vehicle.fuel] ?? ENERGY_PRICES.Benzin
  const fuel = Math.round((annualKm / 100) * consumption * energy.price)

  // Wartung: aus echten Belegen der letzten 12 Monate, sonst geschätzt
  const yearAgo = Date.now() - 365 * 86_400_000
  const recorded = activities
    .filter((a) => a.costEur && new Date(a.date).getTime() >= yearAgo)
    .reduce((sum, a) => sum + (a.costEur ?? 0), 0)

  const estimatedMaintenance = Math.round(
    (annualKm / 15_000) * 420 * profile.partsFactor * (ageYears(vehicle) > 8 ? 1.4 : 1),
  )
  const maintenanceFromRecords = recorded > 0
  const maintenance = maintenanceFromRecords ? Math.round(recorded) : estimatedMaintenance

  const totalYear = Math.round(depreciation + tax + insurance + fuel + maintenance)

  return {
    annualKm,
    depreciation: Math.round(depreciation),
    tax: Math.round(tax),
    insurance: Math.round(insurance),
    fuel,
    maintenance,
    totalYear,
    totalMonth: Math.round(totalYear / 12),
    perKm: Math.round((totalYear / annualKm) * 100) / 100,
    maintenanceFromRecords,
    fuelPricePerUnit: energy.price,
    fuelUnit: energy.unit,
  }
}

function addYear(d: Date) {
  const next = new Date(d)
  next.setFullYear(next.getFullYear() + 1)
  return next
}

function ageYears(v: Vehicle) {
  return new Date().getFullYear() - v.year
}
