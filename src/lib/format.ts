const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const eurCents = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})
const num = new Intl.NumberFormat('de-DE')
const dateFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' })

export const formatEur = (v: number) => eur.format(Math.round(v))
export const formatEurCents = (v: number) => eurCents.format(v)
export const formatNumber = (v: number) => num.format(v)
export const formatKm = (v: number) => `${num.format(Math.round(v))} km`

export function formatDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d)
}

export function formatMonth(iso: string) {
  return monthFmt.format(new Date(iso))
}

export function formatRange(min: number, max: number) {
  return `${formatEur(min)} – ${formatEur(max)}`
}

/** "vor 3 Tagen", "in 2 Monaten" – relativ zum heutigen Tag */
export function formatRelative(iso?: string) {
  if (!iso) return '—'
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return '—'
  const diffDays = Math.round((target - Date.now()) / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' })
  if (Math.abs(diffDays) < 31) return rtf.format(diffDays, 'day')
  const months = Math.round(diffDays / 30.44)
  if (Math.abs(months) < 24) return rtf.format(months, 'month')
  return rtf.format(Math.round(diffDays / 365.25), 'year')
}

export function monthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export function addMonths(iso: string, months: number) {
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

export function todayIso() {
  return new Date().toISOString()
}

export function uid() {
  return crypto.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
