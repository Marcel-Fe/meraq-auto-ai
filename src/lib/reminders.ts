import type { MaintenanceItem, Vehicle, VehicleDocument } from '../types'

/**
 * Termine rund ums Fahrzeug als Kalender-Datei (.ics).
 *
 * Die App verschickt bewusst keine Push-Nachrichten: Dafür bräuchte es einen
 * Server, der die Nachrichten zustellt – und den gibt es hier nicht. Stattdessen
 * wandern die Termine in den Kalender des Nutzers, der ohnehin schon erinnert.
 */

export type ReminderKind = 'hu' | 'maintenance' | 'document'

export interface Reminder {
  id: string
  kind: ReminderKind
  title: string
  /** ISO-Datum der Fälligkeit */
  date: string
  detail: string
  /** Vorlauf der Erinnerung in Tagen */
  leadDays: number
  /** Fälligkeit liegt in der Vergangenheit */
  overdue: boolean
}

const DAY = 86_400_000

/**
 * Alle Termine, die sich aus den Daten des Nutzers wirklich datieren lassen.
 *
 * Wartungspositionen ohne Zeitintervall bleiben außen vor: Wann 15.000 km
 * erreicht sind, hängt vom Fahrverhalten ab – ein Datum dafür wäre geraten.
 */
export function collectReminders(
  vehicle: Vehicle,
  maintenance: MaintenanceItem[],
  documents: VehicleDocument[],
): Reminder[] {
  const list: Reminder[] = []
  const now = Date.now()

  if (vehicle.huDue) {
    list.push({
      id: `hu-${vehicle.id}`,
      kind: 'hu',
      title: `HU fällig – ${vehicle.make} ${vehicle.model}`,
      date: vehicle.huDue,
      detail: 'Hauptuntersuchung inklusive Abgasuntersuchung. Termin am besten vier Wochen vorher vereinbaren.',
      leadDays: 30,
      overdue: new Date(vehicle.huDue).getTime() < now,
    })
  }

  for (const item of maintenance) {
    if (item.intervalMonths <= 0 || !item.lastDoneAt) continue
    const due = new Date(item.lastDoneAt)
    if (Number.isNaN(due.getTime())) continue
    due.setMonth(due.getMonth() + item.intervalMonths)
    list.push({
      id: `maintenance-${item.id}`,
      kind: 'maintenance',
      title: `${item.label} – ${vehicle.make} ${vehicle.model}`,
      date: due.toISOString(),
      detail:
        `Intervall: ${item.intervalMonths} Monate` +
        (item.intervalKm > 0 ? ` oder ${item.intervalKm.toLocaleString('de-DE')} km` : '') +
        (item.note ? `\n${item.note}` : ''),
      leadDays: 14,
      overdue: due.getTime() < now,
    })
  }

  for (const doc of documents) {
    if (!doc.expiresAt) continue
    const end = new Date(doc.expiresAt)
    if (Number.isNaN(end.getTime())) continue
    list.push({
      id: `document-${doc.id}`,
      kind: 'document',
      title: `${doc.title} läuft ab`,
      date: doc.expiresAt,
      detail: `${doc.category} – abgelegt in MERAQ AUTO AI unter Dokumente.`,
      leadDays: 21,
      overdue: end.getTime() < now,
    })
  }

  return list.sort((a, b) => +new Date(a.date) - +new Date(b.date))
}

/** Kalender-Datei nach RFC 5545 mit einer Erinnerung je Termin */
export function buildIcs(reminders: Reminder[], calendarName: string): string {
  const stamp = utcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MERAQ AUTO AI//Fahrzeugtermine//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  for (const r of reminders) {
    const start = new Date(r.date)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@meraq-auto-ai`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dayStamp(start)}`,
      `DTEND;VALUE=DATE:${dayStamp(new Date(start.getTime() + DAY))}`,
      `SUMMARY:${escapeText(r.title)}`,
      `DESCRIPTION:${escapeText(r.detail)}`,
      'BEGIN:VALARM',
      `TRIGGER:-P${r.leadDays}D`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(r.title)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** JJJJMMTT in Ortszeit – ein ganztägiger Termin soll nicht durch die Zeitzone rutschen */
function dayStamp(d: Date) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function utcStamp(d: Date) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Lange Zeilen umbrechen – das Format erlaubt höchstens 75 Oktette je Zeile */
function fold(line: string) {
  if (line.length <= 70) return line
  const parts: string[] = [line.slice(0, 70)]
  let rest = line.slice(70)
  while (rest.length > 69) {
    parts.push(` ${rest.slice(0, 69)}`)
    rest = rest.slice(69)
  }
  if (rest) parts.push(` ${rest}`)
  return parts.join('\r\n')
}
