import type { ActivityEntry, Vehicle } from '../types'
import { calculateCosts, calculateTax, type CostBreakdown } from './costs'
import { valuate, type Valuation } from './valuation'

/**
 * Gegenüberstellung mehrerer Fahrzeuge.
 *
 * Gerechnet wird ausschließlich mit den vorhandenen Bausteinen: `calculateCosts()`
 * und `valuate()` werden je Fahrzeug aufgerufen, nichts davon wird hier umgebaut.
 * Bewusst ohne React, damit die Zusammenstellung für sich prüfbar bleibt.
 */

export interface VehicleComparison {
  vehicle: Vehicle
  costs: CostBreakdown
  valuation: Valuation
  /** Warum sich die Kfz-Steuer nicht berechnen lässt – dann ist sie unbekannt, nicht null */
  taxMissing?: string
}

export function compareVehicles(
  vehicles: Vehicle[],
  activities: ActivityEntry[],
): VehicleComparison[] {
  return vehicles.map((vehicle) => ({
    vehicle,
    costs: calculateCosts(
      vehicle,
      activities.filter((a) => a.vehicleId === vehicle.id),
    ),
    valuation: valuate(vehicle),
    taxMissing: calculateTax(vehicle).missing,
  }))
}

export type MetricFormat = 'eur' | 'eurCents' | 'km'

export interface CompareMetric {
  key: string
  label: string
  /** Kurzer Hinweis unter der Bezeichnung – etwa wenn Werte nicht gleichwertig sind */
  hint?: string
  /** Ein Wert je Fahrzeug, gleiche Reihenfolge wie die übergebenen Fahrzeuge. null = unbekannt */
  values: (number | null)[]
  format: MetricFormat
  /** 'low' = weniger ist günstiger, 'none' = kein Urteil möglich oder sinnvoll */
  better: 'low' | 'none'
  /** Index des günstigsten Fahrzeugs; null bei Gleichstand, Unbekanntem oder ohne Urteil */
  bestIndex: number | null
}

/** Der günstigste Wert – aber nur, wenn es ihn eindeutig gibt und mindestens zwei Werte bekannt sind */
function lowestIndex(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null)
  if (known.length < 2) return null
  const min = Math.min(...known)
  if (known.filter((v) => v === min).length > 1) return null
  return values.findIndex((v) => v === min)
}

function metric(
  key: string,
  label: string,
  values: (number | null)[],
  format: MetricFormat,
  better: 'low' | 'none',
  hint?: string,
): CompareMetric {
  return {
    key,
    label,
    hint,
    values,
    format,
    better,
    bestIndex: better === 'low' ? lowestIndex(values) : null,
  }
}

/** Heißt der Posten „Kraftstoff", „Strom" oder beides? */
function energyLabel(entries: VehicleComparison[]): string {
  const electric = entries.filter((e) => e.vehicle.fuel === 'Elektro').length
  if (electric === entries.length) return 'Strom'
  if (electric === 0) return 'Kraftstoff'
  return 'Kraftstoff bzw. Strom'
}

export function compareMetrics(entries: VehicleComparison[]): CompareMetric[] {
  const anyTaxMissing = entries.some((e) => e.taxMissing)
  const mixedRecords =
    new Set(entries.map((e) => e.costs.maintenanceFromRecords)).size > 1
  const mixedUnits = new Set(entries.map((e) => e.costs.fuelUnit)).size > 1

  const totalHint = anyTaxMissing
    ? 'ohne die Kfz-Steuer, wo dafür Angaben fehlen'
    : undefined

  return [
    metric(
      'month',
      'Kosten pro Monat',
      entries.map((e) => e.costs.totalMonth),
      'eur',
      'low',
      totalHint,
    ),
    metric(
      'perKm',
      'Kosten pro Kilometer',
      entries.map((e) => e.costs.perKm),
      'eurCents',
      'low',
      totalHint,
    ),
    metric(
      'annualKm',
      'Fahrleistung pro Jahr',
      entries.map((e) => e.costs.annualKm),
      'km',
      'none',
      'Grundlage der Rechnung – wer mehr fährt, zahlt mehr',
    ),
    metric(
      'depreciation',
      'Wertverlust pro Jahr',
      entries.map((e) => e.costs.depreciation),
      'eur',
      'low',
    ),
    metric(
      'fuel',
      energyLabel(entries),
      entries.map((e) => e.costs.fuel),
      'eur',
      'low',
      mixedUnits ? 'unterschiedliche Einheiten – verglichen werden die Jahreskosten' : undefined,
    ),
    metric(
      'maintenance',
      'Wartung & Reparatur',
      entries.map((e) => e.costs.maintenance),
      'eur',
      mixedRecords ? 'none' : 'low',
      mixedRecords
        ? 'einmal aus erfassten Belegen, einmal geschätzt – nicht gleichwertig'
        : entries[0]?.costs.maintenanceFromRecords
          ? 'aus Deinen erfassten Belegen der letzten 12 Monate'
          : 'geschätzt – erfasse Rechnungen für echte Zahlen',
    ),
    metric(
      'insurance',
      'Versicherung',
      entries.map((e) => e.costs.insurance),
      'eur',
      'low',
    ),
    metric(
      'tax',
      'Kfz-Steuer',
      entries.map((e) => (e.taxMissing ? null : e.costs.tax)),
      'eur',
      'low',
      anyTaxMissing ? 'wo Hubraum oder CO₂-Wert fehlen, bleibt sie offen' : undefined,
    ),
    metric(
      'value',
      'Marktwert heute',
      entries.map((e) => e.valuation.privateSale),
      'eur',
      'none',
      'Privatverkauf – ein höherer Wert ist nicht automatisch besser',
    ),
  ]
}
