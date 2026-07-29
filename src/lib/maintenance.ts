import type { MaintenanceItem, MaintenanceKind, Vehicle } from '../types'
import { uid } from './format'

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

/** Standard-Wartungsplan, abhängig von Antriebsart */
export function defaultMaintenance(vehicle: Vehicle): MaintenanceItem[] {
  const isElectric = vehicle.fuel === 'Elektro'
  const base: { kind: MaintenanceKind; label: string; km: number; months: number }[] = [
    { kind: 'inspection', label: 'Inspektion', km: 30_000, months: 24 },
    { kind: 'brake-fluid', label: 'Bremsflüssigkeit', km: 0, months: 24 },
    { kind: 'cabin-filter', label: 'Innenraumfilter', km: 30_000, months: 12 },
    { kind: 'ac-service', label: 'Klimaservice', km: 0, months: 24 },
    { kind: 'tires', label: 'Reifen prüfen / wechseln', km: 40_000, months: 6 },
    { kind: 'battery', label: 'Batterie prüfen', km: 0, months: 24 },
  ]

  if (!isElectric) {
    base.unshift({ kind: 'oil', label: 'Ölwechsel', km: 15_000, months: 12 })
    base.push({ kind: 'air-filter', label: 'Luftfilter', km: 30_000, months: 24 })
    if (vehicle.fuel === 'Benzin' || vehicle.fuel === 'Hybrid' || vehicle.fuel === 'Plug-in-Hybrid') {
      base.push({ kind: 'spark-plugs', label: 'Zündkerzen', km: 60_000, months: 48 })
    }
    base.push({ kind: 'timing-belt', label: 'Zahnriemen / Steuerkette prüfen', km: 120_000, months: 96 })
  }

  // Startwert: zuletzt erledigt bei einem plausiblen früheren Kilometerstand
  return base.map(({ kind, label, km, months }) => ({
    id: uid(),
    vehicleId: vehicle.id,
    kind,
    label,
    intervalKm: km,
    intervalMonths: months,
    lastDoneKm: km ? Math.max(0, vehicle.mileage - Math.round(km * 0.6)) : undefined,
    lastDoneAt: monthsAgoIso(Math.round(months * 0.6)),
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
