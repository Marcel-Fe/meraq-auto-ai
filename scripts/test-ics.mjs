/**
 * Prüft die Kalender-Datei gegen die Formatregeln (RFC 5545).
 *
 * Ein fehlerhaftes .ics lädt und speichert sich klaglos – auffallen würde es erst,
 * wenn der Kalender des Nutzers den Import verweigert. Deshalb hier Zeile für Zeile.
 *
 * Aufruf: npm run test:ics
 */
import { buildIcs, collectReminders } from '../src/lib/reminders.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

const reminder = (patch = {}) => ({
  id: 'hu-1',
  kind: 'hu',
  title: 'HU fällig – Mercedes-Benz Sprinter',
  date: '2026-11-15T00:00:00.000Z',
  detail: 'Hauptuntersuchung inklusive Abgasuntersuchung. Termin am besten vier Wochen vorher vereinbaren.',
  leadDays: 30,
  overdue: false,
  ...patch,
})

/** Zerlegt die Datei in logische Zeilen: fortgesetzte Zeilen beginnen mit einem Leerzeichen */
function unfold(ics) {
  const out = []
  for (const raw of ics.split('\r\n')) {
    if (raw.startsWith(' ') && out.length) out[out.length - 1] += raw.slice(1)
    else out.push(raw)
  }
  return out.filter((l) => l !== '')
}

console.log('Grundgerüst')
{
  const ics = buildIcs([reminder()], 'MERAQ Termine')
  const lines = unfold(ics)
  check('Beginnt und endet korrekt', lines[0] === 'BEGIN:VCALENDAR' && lines.at(-1) === 'END:VCALENDAR')
  check('Zeilenenden sind CRLF', !/[^\r]\n/.test(ics))
  check('Datei endet mit CRLF', ics.endsWith('\r\n'))
  for (const key of ['VERSION:2.0', 'PRODID:', 'BEGIN:VEVENT', 'UID:', 'DTSTAMP:', 'DTSTART', 'DTEND', 'SUMMARY:', 'END:VEVENT']) {
    check(`Pflichtangabe ${key}`, lines.some((l) => l.startsWith(key)))
  }
  const alarm = lines.filter((l) => l === 'BEGIN:VALARM').length
  check('Genau eine Erinnerung je Termin', alarm === 1, `gefunden: ${alarm}`)
  check('Vorlauf als gültige Dauer', lines.includes('TRIGGER:-P30D'))
}

console.log('\nZeilenlänge – RFC 5545 erlaubt 75 Oktette, nicht 75 Zeichen')
{
  const lang = 'Ölwechsel, Bremsflüssigkeit prüfen, Zündkerzen tauschen – dazu Klimaservice für die wärmere Jahreszeit'
  const ics = buildIcs([reminder({ detail: lang, title: 'Große Inspektion – Volkswagen Golf Variant Höchstädt' })], 'Übersicht')
  const zuLang = ics
    .split('\r\n')
    .filter((l) => Buffer.byteLength(l, 'utf8') > 75)
  check('Keine Zeile über 75 Oktette', zuLang.length === 0, `${zuLang.length} zu lange Zeile(n), längste ${Math.max(0, ...zuLang.map((l) => Buffer.byteLength(l, 'utf8')))} Oktette`)

  // Zusammengesetzt muss wieder der Originaltext herauskommen
  const beschreibung = unfold(ics).find((l) => l.startsWith('DESCRIPTION:') && l.includes('Ölwechsel'))
  check('Umbruch zerstört den Text nicht', beschreibung?.includes('Klimaservice für die wärmere Jahreszeit') === true)
  check('Keine kaputten Zeichen durch den Umbruch', !ics.includes('�'))
}

console.log('\nSonderzeichen im Text')
{
  const ics = buildIcs(
    [reminder({ detail: 'Zeile eins\r\nZeile zwei; mit Semikolon, Komma und \\ Backslash\nZeile drei' })],
    'Test',
  )
  const roh = ics.split('\r\n')
  const beginnt = roh.filter((l) => l.length && !/^[ A-Z]/.test(l))
  check('Kein Wagenrücklauf zerreißt die Struktur', beginnt.length === 0, `verdächtige Zeilen: ${JSON.stringify(beginnt.slice(0, 2))}`)

  // Ein rohes CR oder LF im Wert ist ein Formatverstoss – Zeilenenden gehoeren
  // nur zwischen die Zeilen, im Text muss daraus \n werden
  const uebrig = [...ics.replace(/\r\n/g, '')].filter((c) => c === '\r' || c === '\n')
  check('Keine rohen Steuerzeichen im Text', uebrig.length === 0, `${uebrig.length} gefunden`)

  const desc = unfold(ics).find((l) => l.startsWith('DESCRIPTION:') && l.includes('Zeile eins'))
  check('Semikolon ist maskiert', desc?.includes('\\;') === true)
  check('Komma ist maskiert', desc?.includes('\\,') === true)
  check('Backslash ist maskiert', desc?.includes('\\\\') === true)
  check('Zeilenumbruch wird zu \\n', (desc?.match(/\\n/g) ?? []).length >= 2, `gefunden: ${(desc?.match(/\\n/g) ?? []).length}`)
}

console.log('\nGanztägiger Termin')
{
  // 25.10.2026 ist der Tag der Zeitumstellung in Deutschland – er hat 25 Stunden
  const ics = buildIcs([reminder({ date: '2026-10-25T00:00:00.000+02:00' })], 'Zeitumstellung')
  const lines = unfold(ics)
  const start = lines.find((l) => l.startsWith('DTSTART'))?.split(':')[1]
  const end = lines.find((l) => l.startsWith('DTEND'))?.split(':')[1]
  check('Ende liegt nach dem Beginn', start !== end, `DTSTART ${start}, DTEND ${end}`)
  check('Ende ist genau ein Tag später', Number(end) === Number(start) + 1, `DTSTART ${start}, DTEND ${end}`)
}

console.log('\nTermine aus echten Daten')
{
  const vehicle = {
    id: 'v1', kind: 'car', make: 'BMW', model: '320d', year: 2019, mileage: 90_000,
    mileageUpdatedAt: new Date().toISOString(), fuel: 'Diesel', transmission: 'Schaltgetriebe',
    powerKw: 140, condition: 'gut', createdAt: new Date().toISOString(),
    huDue: '2026-09-30T00:00:00.000Z',
  }
  const maintenance = [
    { id: 'm1', vehicleId: 'v1', kind: 'oil', label: 'Ölwechsel', intervalKm: 15_000, intervalMonths: 12, lastDoneAt: '2025-11-01T00:00:00.000Z' },
    { id: 'm2', vehicleId: 'v1', kind: 'tires', label: 'Reifen', intervalKm: 40_000, intervalMonths: 0, lastDoneAt: '2025-01-01T00:00:00.000Z' },
    { id: 'm3', vehicleId: 'v1', kind: 'brake-fluid', label: 'Bremsflüssigkeit', intervalKm: 0, intervalMonths: 24 },
  ]
  const docs = [{ id: 'd1', vehicleId: 'v1', title: 'Versicherungspolice', category: 'Versicherung', date: '2025-01-01', expiresAt: '2026-12-31T00:00:00.000Z' }]

  const list = collectReminders(vehicle, maintenance, docs)
  check('Nur datierbare Termine', list.length === 3, `erwartet 3 (HU, Ölwechsel, Police), bekommen ${list.length}`)
  check('Rein km-basierte Wartung bleibt außen vor', !list.some((r) => r.title.startsWith('Reifen')))
  check('Nie erledigte Wartung bleibt außen vor', !list.some((r) => r.title.startsWith('Bremsflüssigkeit')))
  check('Nach Datum sortiert', list.every((r, i) => i === 0 || +new Date(list[i - 1].date) <= +new Date(r.date)))

  const ics = buildIcs(list, 'MERAQ – BMW 320d')
  check('Ein Ereignis je Termin', (ics.match(/BEGIN:VEVENT/g) ?? []).length === list.length)
  check('Alle Kennungen sind eindeutig', new Set(list.map((r) => r.id)).size === list.length)
}

console.log('\nLeere Liste')
{
  const ics = buildIcs([], 'Leer')
  check('Bleibt eine gültige, leere Datei', ics.startsWith('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR') && !ics.includes('VEVENT'))
}

if (problems.length) {
  console.log(`\nPROBLEME (${problems.length}):`)
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – die Kalender-Datei entspricht dem Format.')
