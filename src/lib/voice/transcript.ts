/**
 * Was aus der Spracherkennung kommt, muss ins Eingabefeld passen.
 *
 * Zwei Quellen, ein Ergebnis: die Spracherkennung des Geräts liefert rohen
 * Fließtext ohne Satzzeichen, die KI liefert manchmal eine hilfsbereite
 * Verpackung („Transkription: …", Anführungszeichen, ein Kommentar dazu).
 * Beides wird hier auf das zurückgeführt, was der Nutzer gesagt hat – und nur
 * darauf. Ein Modell, das die Frage gleich beantwortet, statt sie
 * mitzuschreiben, darf seinen Text nicht ins Eingabefeld bekommen.
 *
 * Ohne Browser prüfbar: `npm run test:voice`.
 */

/** Länger spricht niemand eine Frage – darüber ist etwas schiefgelaufen */
export const MAX_TRANSCRIPT_CHARS = 2000

/** Verpackungen, die Modelle gern voranstellen */
const PREFIXES = [
  /^transkript(ion)?\s*[:–-]\s*/i,
  /^wortlaut\s*[:–-]\s*/i,
  /^gesagt(es)?\s*[:–-]\s*/i,
  /^der\s+nutzer\s+sagt\s*[:–-]\s*/i,
  /^text\s*[:–-]\s*/i,
]

/** Antworten, die bedeuten „da war nichts" */
const EMPTY_MARKERS = [
  /^\(?\s*(unverst[äa]ndlich|nichts?\s+(zu\s+)?(geh[öo]rt|verstanden)|keine?\s+sprache|stille|leer)\s*\)?[.!]?$/i,
  /^\[?\s*(inaudible|silence|no\s+speech)\s*\]?[.!]?$/i,
]

/**
 * Rohtext auf den gesprochenen Satz zurückführen.
 * Leerer Rückgabewert heißt: Es gibt nichts zu übernehmen.
 */
export function sanitizeTranscript(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  for (const prefix of PREFIXES) text = text.replace(prefix, '').trim()

  // Umschließende Anführungszeichen entfernen – aber nur, wenn sie wirklich den
  // ganzen Text umschließen, sonst zerlegt es ein Zitat innerhalb des Satzes
  const quoted = /^["'„“»«](.*)["'“”»«]$/s.exec(text)
  if (quoted) text = quoted[1].trim()

  // Einschübe der Erkennung wie „[unverständlich]" fliegen raus, der Rest bleibt
  text = text
    .replace(/[[(]\s*(unverst[äa]ndlich|inaudible|unclear)\s*[)\]]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  if (EMPTY_MARKERS.some((marker) => marker.test(text))) return ''

  return text.slice(0, MAX_TRANSCRIPT_CHARS).trim()
}

/**
 * Neuen Text an das anhängen, was schon im Feld steht.
 *
 * Wichtig, weil man in mehreren Anläufen spricht: Wer nach einer Pause
 * weiterredet, will ergänzen und nicht das Bisherige verlieren.
 */
export function appendTranscript(existing: string, addition: string): string {
  const left = existing.trimEnd()
  const right = addition.trim()
  if (!right) return existing
  if (!left) return right
  // Nach einem Satzzeichen groß weiterschreiben wäre geraten – der Nutzer
  // korrigiert im Feld, deshalb bleibt der Text so, wie er gesprochen wurde
  return `${left} ${right}`
}

/**
 * Fehlercodes der Geräte-Spracherkennung in Sätze übersetzen, mit denen der
 * Nutzer etwas anfangen kann. Die Codes sind in der Web-Speech-Schnittstelle
 * festgelegt.
 */
export function describeSpeechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Das Mikrofon ist nicht freigegeben. Erlaube den Zugriff in den Browser-Einstellungen für diese Seite.'
    case 'audio-capture':
      return 'Kein Mikrofon gefunden. Prüfe, ob eines angeschlossen und nicht von einer anderen App belegt ist.'
    case 'no-speech':
      return 'Ich habe nichts gehört. Sprich etwas näher am Mikrofon.'
    case 'network':
      return 'Die Spracherkennung braucht eine Internetverbindung. Prüfe Deine Verbindung.'
    case 'language-not-supported':
      return 'Dieses Gerät erkennt kein Deutsch. Nimm stattdessen die Aufnahme – die übernimmt die KI.'
    case 'aborted':
      return ''
    default:
      return 'Die Spracherkennung des Geräts hat abgebrochen. Versuch es noch einmal oder tippe die Frage.'
  }
}
