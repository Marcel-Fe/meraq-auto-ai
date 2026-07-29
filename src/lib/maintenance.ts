import type { MaintenanceItem, MaintenanceKind, Vehicle } from '../types'
import { uid } from './format'
import { vehicleTraits } from './vehicleProfile'

export interface MaintenanceStatus {
  item: MaintenanceItem
  /** Verbleibende Kilometer bis fällig (null = kein km-Intervall) */
  kmLeft: number | null
  /** Verbleibende Tage bis fällig (null = kein Zeitintervall) */
  daysLeft: number | null
  /** 0 = frisch erledigt, 1 = fällig, >1 = überfällig */
  progress: number
  state: 'ok' | 'soon' | 'due' | 'overdue'
  dueLabel: string
}

interface PlanEntry {
  kind: MaintenanceKind
  label: string
  km: number
  months: number
}

/**
 * Wartungsplan passend zum Fahrzeug.
 *
 * Ein Motorrad braucht Kettenpflege und Ventilspiel, ein E-Auto weder Öl noch
 * Zündkerzen, ein Lkw kürzere Intervalle. Deshalb wird der Plan aus den
 * Fahrzeugeigenschaften zusammengesetzt statt fest vorgegeben.
 *
 * Die Intervalle sind übliche Richtwerte – maßgeblich bleibt der Wartungsplan
 * des Herstellers. Darauf weist der Wartungs-Screen ausdrücklich hin.
 */
export function defaultMaintenance(vehicle: Vehicle): MaintenanceItem[] {
  const t = vehicleTraits(vehicle)
  const plan: PlanEntry[] = []

  // --- Motor und Antrieb ---
  if (t.hasEngineOil) {
    const oilKm =
      vehicle.kind === 'motorcycle' ? 8_000 : vehicle.kind === 'truck' || vehicle.kind === 'bus' ? 45_000 : 15_000
    plan.push({ kind: 'oil', label: 'Ölwechsel', km: oilKm, months: 12 })
  }
  if (t.hasCombustionEngine) {
    plan.push({ kind: 'air-filter', label: 'Luftfilter', km: 30_000, months: 24 })
  }
  if (t.hasSparkPlugs) {
    plan.push({ kind: 'spark-plugs', label: 'Zündkerzen', km: 60_000, months: 48 })
  }
  if (t.hasDiesel) {
    plan.push({ kind: 'spark-plugs', label: 'Glühkerzen prüfen', km: 100_000, months: 72 })
  }
  if (t.hasTimingBelt) {
    plan.push({ kind: 'timing-belt', label: 'Steuerkette / Zahnriemen', km: 120_000, months: 96 })
  }
  if (t.hasChainDrive) {
    plan.push({ kind: 'chain', label: 'Antriebskette pflegen', km: 1_000, months: 1 })
    plan.push({ kind: 'valve-clearance', label: 'Ventilspiel prüfen', km: 20_000, months: 24 })
  }
  if (t.hasCoolant) {
    plan.push({ kind: 'coolant', label: 'Kühlmittel wechseln', km: 0, months: 36 })
  }
  if (t.hasParticulateFilter) {
    plan.push({ kind: 'dpf', label: 'Partikelfilter prüfen', km: 80_000, months: 48 })
  }

  // --- Elektrik ---
  if (t.hasHighVoltageBattery) {
    plan.push({ kind: 'hv-battery', label: 'Hochvoltbatterie prüfen', km: 0, months: 24 })
  }
  plan.push({ kind: 'battery', label: 'Starterbatterie prüfen', km: 0, months: 24 })

  // --- Bremsen, Fahrwerk, Innenraum ---
  plan.push({ kind: 'brake-fluid', label: 'Bremsflüssigkeit', km: 0, months: 24 })
  plan.push({
    kind: 'tires',
    label: 'Reifen prüfen',
    km: vehicle.kind === 'motorcycle' ? 15_000 : 40_000,
    months: 6,
  })
  if (t.hasAirConditioning) {
    plan.push({ kind: 'cabin-filter', label: 'Innenraumfilter', km: 30_000, months: 12 })
    plan.push({ kind: 'ac-service', label: 'Klimaservice', km: 0, months: 24 })
  }

  // --- Inspektion ---
  const inspectionMonths = vehicle.kind === 'truck' || vehicle.kind === 'bus' ? 12 : 24
  const inspectionKm =
    vehicle.kind === 'motorcycle' ? 12_000 : vehicle.kind === 'truck' || vehicle.kind === 'bus' ? 60_000 : 30_000
  plan.push({ kind: 'inspection', label: 'Inspektion', km: inspectionKm, months: inspectionMonths })

  // Startwerte so setzen, dass der Plan sofort sinnvoll aussieht: die Position gilt
  // als vor rund 60 % des Intervalls erledigt. Bei sehr kurzen Zeitintervallen
  // (z. B. Kettenpflege monatlich) wird das Datum auf heute gesetzt – sonst wäre
  // ein frisch angelegtes Fahrzeug sofort überfällig, was wie ein Fehler wirkt.
  return plan.map(({ kind, label, km, months }) => ({
    id: uid(),
    vehicleId: vehicle.id,
    kind,
    label,
    intervalKm: km,
    intervalMonths: months,
    lastDoneKm: km ? Math.max(0, vehicle.mileage - Math.round(km * 0.6)) : undefined,
    lastDoneAt: monthsAgoIso(months <= 3 ? 0 : Math.round(months * 0.6)),
  }))
}

function monthsAgoIso(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

export function maintenanceStatus(item: MaintenanceItem, vehicle: Vehicle): MaintenanceStatus {
  const kmLeft =
    item.intervalKm > 0 && item.lastDoneKm != null
      ? item.lastDoneKm + item.intervalKm - vehicle.mileage
      : null

  let daysLeft: number | null = null
  if (item.intervalMonths > 0 && item.lastDoneAt) {
    const due = new Date(item.lastDoneAt)
    due.setMonth(due.getMonth() + item.intervalMonths)
    daysLeft = Math.round((due.getTime() - Date.now()) / 86_400_000)
  }

  // Fortschritt: das knappere der beiden Intervalle bestimmt die Fälligkeit
  const kmProgress = kmLeft != null && item.intervalKm > 0 ? 1 - kmLeft / item.intervalKm : 0
  const timeProgress =
    daysLeft != null && item.intervalMonths > 0 ? 1 - daysLeft / (item.intervalMonths * 30.44) : 0
  const progress = Math.max(kmProgress, timeProgress)

  const state: MaintenanceStatus['state'] =
    progress >= 1 ? 'overdue' : progress >= 0.9 ? 'due' : progress >= 0.75 ? 'soon' : 'ok'

  return { item, kmLeft, daysLeft, progress: Math.max(0, progress), state, dueLabel: dueLabel(kmLeft, daysLeft) }
}

function dueLabel(kmLeft: number | null, daysLeft: number | null): string {
  const parts: string[] = []
  if (kmLeft != null) {
    parts.push(
      kmLeft >= 0
        ? `in ${kmLeft.toLocaleString('de-DE')} km`
        : `${Math.abs(kmLeft).toLocaleString('de-DE')} km überfällig`,
    )
  }
  if (daysLeft != null) {
    const months = Math.round(daysLeft / 30.44)
    if (daysLeft < 0) parts.push(`${Math.abs(months) || 1} Mon. überfällig`)
    else if (daysLeft < 45) parts.push(`in ${daysLeft} Tagen`)
    else parts.push(`in ${months} Monaten`)
  }
  return parts.join(' · ') || 'kein Intervall hinterlegt'
}

export function sortByUrgency(list: MaintenanceStatus[]) {
  return [...list].sort((a, b) => b.progress - a.progress)
}
