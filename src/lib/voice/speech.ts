import { describeSpeechError, sanitizeTranscript } from './transcript'

/**
 * Diktat über die Spracherkennung des Geräts.
 *
 * Der schnellste Weg: Der Text erscheint beim Sprechen, es kostet kein
 * KI-Kontingent, und ohne Schlüssel funktioniert es auch. Safari, Chrome und
 * Edge können das; Firefox nicht, und in einer installierten Web-App auf dem
 * iPhone ist es je nach iOS-Fassung launisch. Deshalb ist es hier nur der
 * bevorzugte Weg und nicht der einzige – scheitert er, übernimmt die Aufnahme
 * (`recorder.ts`) samt Transkription durch die KI.
 *
 * Die Web-Speech-Schnittstelle steht nicht in den Standard-Typen des Browsers,
 * deshalb die schmalen eigenen Typen unten. Nur das, was hier benutzt wird.
 */

interface SpeechAlternative {
  transcript: string
}

interface SpeechResult {
  isFinal: boolean
  0: SpeechAlternative
}

interface SpeechResultEvent {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResult }
}

interface SpeechErrorEvent {
  error: string
}

interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognizerConstructor = new () => SpeechRecognizer

function constructor(): RecognizerConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: RecognizerConstructor
    webkitSpeechRecognition?: RecognizerConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function dictationSupported(): boolean {
  return !!constructor()
}

export interface Dictation {
  /** Sauber beenden – das letzte Ergebnis kommt noch */
  stop(): void
  /** Sofort abbrechen, ohne Ergebnis */
  abort(): void
}

export interface DictationOptions {
  lang?: string
  /** Zwischenstand während des Sprechens – zum Anzeigen, nicht zum Übernehmen */
  onInterim?: (text: string) => void
  /** Ein fertig erkannter Abschnitt */
  onFinal: (text: string) => void
  /** Meldung für den Nutzer und der rohe Code, damit der Aufrufer umschalten kann */
  onError: (message: string, code: string) => void
  onEnd: () => void
}

/**
 * Wie oft nach einer Sprechpause neu gestartet wird.
 *
 * Safari beendet die Erkennung nach jeder längeren Pause von selbst. Ohne
 * Neustart bricht das Diktat mitten im Satz ab, und der Nutzer hält den Knopf
 * für kaputt. Begrenzt, damit ein dauerhaft scheiterndes Gerät nicht in eine
 * Endlosschleife läuft.
 */
const MAX_RESTARTS = 12

export function startDictation(opts: DictationOptions): Dictation {
  const Recognizer = constructor()
  if (!Recognizer) throw new Error('Dieses Gerät hat keine eigene Spracherkennung.')

  const recognizer = new Recognizer()
  recognizer.lang = opts.lang ?? 'de-DE'
  recognizer.continuous = true
  recognizer.interimResults = true
  recognizer.maxAlternatives = 1

  let stopped = false
  let failed = false
  let restarts = 0

  recognizer.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) {
        const clean = sanitizeTranscript(text)
        if (clean) opts.onFinal(clean)
      } else {
        interim += text
      }
    }
    opts.onInterim?.(interim.trim())
  }

  recognizer.onerror = (event) => {
    // Ein Abbruch durch den Nutzer ist kein Fehler, und „nichts gehört" ist
    // während eines laufenden Diktats normal – beides würde nur erschrecken
    if (event.error === 'aborted' || (event.error === 'no-speech' && !stopped)) return
    failed = true
    const message = describeSpeechError(event.error)
    if (message) opts.onError(message, event.error)
  }

  recognizer.onend = () => {
    if (!stopped && !failed && restarts < MAX_RESTARTS) {
      restarts++
      try {
        recognizer.start()
        return
      } catch {
        /* Neustart abgelehnt – dann ist das Diktat eben zu Ende */
      }
    }
    stopped = true
    opts.onInterim?.('')
    opts.onEnd()
  }

  recognizer.start()

  return {
    stop() {
      stopped = true
      recognizer.stop()
    },
    abort() {
      stopped = true
      recognizer.abort()
    },
  }
}
