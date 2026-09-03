import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { cn } from './ui'
import { audioTranscriptionAvailable, describeAiError, transcribeAudio } from '../lib/ai/client'
import { SYSTEM_TRANSCRIBE } from '../lib/ai/prompts'
import { dictationSupported, startDictation, type Dictation } from '../lib/voice/speech'
import { recordingSupported, startRecording, SilentRecordingError, type Recording } from '../lib/voice/recorder'
import { sanitizeTranscript } from '../lib/voice/transcript'

/**
 * Die Frage sprechen statt tippen.
 *
 * Ein Knopf, zwei Wege dahinter – der Nutzer merkt davon nichts:
 *
 * 1. **Diktat** über die Spracherkennung des Geräts. Der Text erscheint beim
 *    Sprechen, kostet kein KI-Kontingent und ist sofort da.
 * 2. **Aufnehmen und von der KI mitschreiben lassen**, wenn es 1. nicht gibt
 *    (Firefox, manche installierte Web-Apps) oder der Dienst dahinter nicht
 *    erreichbar ist.
 *
 * Abgeschickt wird nie automatisch. Der erkannte Text landet im Eingabefeld,
 * wird gelesen, bei Bedarf korrigiert – und erst dann gesendet. Eine falsch
 * verstandene Frage, die von allein rausgeht, wäre schlimmer als tippen.
 */

export type VoiceState = 'idle' | 'listening' | 'recording' | 'transcribing'

/** Fehler des Diktats, bei denen sich die Aufnahme lohnt statt aufzugeben */
const FALLBACK_ERRORS = new Set(['network', 'service-not-allowed', 'language-not-supported'])

export interface VoiceInput {
  state: VoiceState
  /** Zwischenstand während des Diktats – nur zum Anzeigen */
  interim: string
  error: string
  /** Kann dieses Gerät mit dieser Einstellung überhaupt zuhören? */
  supported: boolean
  /** Warum nicht, falls nicht */
  unsupportedReason: string
  toggle(): void
  cancel(): void
}

export function useVoiceInput(opts: {
  /** Erkannter Text – wird angehängt, nicht ersetzt */
  onText: (text: string) => void
  /** Kurzer Fahrzeugkontext für die richtige Schreibweise */
  context?: string
  disabled?: boolean
}): VoiceInput {
  const [state, setState] = useState<VoiceState>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')

  const dictation = useRef<Dictation | null>(null)
  const recording = useRef<Recording | null>(null)
  const triedFallback = useRef(false)
  const alive = useRef(true)

  const canDictate = dictationSupported()
  const canRecord = recordingSupported() && audioTranscriptionAvailable()
  const supported = canDictate || canRecord

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      dictation.current?.abort()
      recording.current?.cancel()
    }
  }, [])

  const unsupportedReason = supported
    ? ''
    : recordingSupported()
      ? 'Dieses Gerät hat keine eigene Spracherkennung. Stell in den Einstellungen auf Google um – dann schreibt die KI Deine Aufnahme mit, der Schlüssel dafür ist kostenlos.'
      : 'Dieser Browser kann kein Mikrofon nutzen. Tippe die Frage oder öffne die App in Safari, Chrome oder Edge.'

  const beginRecording = useCallback(async () => {
    try {
      recording.current = await startRecording()
      setState('recording')
    } catch (err) {
      recording.current = null
      setState('idle')
      setError(err instanceof Error ? err.message : 'Das Mikrofon lässt sich nicht öffnen.')
    }
  }, [])

  const beginDictation = useCallback(() => {
    try {
      dictation.current = startDictation({
        onInterim: (text) => alive.current && setInterim(text),
        onFinal: (text) => alive.current && opts.onText(text),
        onError: (message, code) => {
          if (!alive.current) return
          // Der Dienst hinter der Geräte-Erkennung ist nicht erreichbar –
          // dann übernimmt die Aufnahme, statt den Nutzer stehen zu lassen
          if (FALLBACK_ERRORS.has(code) && canRecord && !triedFallback.current) {
            triedFallback.current = true
            dictation.current?.abort()
            dictation.current = null
            setError('')
            void beginRecording()
            return
          }
          setError(message)
        },
        onEnd: () => {
          if (!alive.current) return
          dictation.current = null
          setInterim('')
          setState((current) => (current === 'listening' ? 'idle' : current))
        },
      })
      setState('listening')
    } catch {
      dictation.current = null
      if (canRecord) void beginRecording()
      else setError('Die Spracherkennung lässt sich nicht starten.')
    }
  }, [opts, canRecord, beginRecording])

  const finishRecording = useCallback(async () => {
    const active = recording.current
    recording.current = null
    if (!active) return setState('idle')

    setState('transcribing')
    try {
      const audio = await active.stop()
      const text = sanitizeTranscript(
        await transcribeAudio({ audioDataUrl: audio, system: SYSTEM_TRANSCRIBE, context: opts.context }),
      )
      if (!alive.current) return
      if (text) opts.onText(text)
      else setError('Aus der Aufnahme war nichts zu verstehen. Versuch es noch einmal.')
    } catch (err) {
      if (!alive.current) return
      setError(
        err instanceof SilentRecordingError
          ? 'Die Aufnahme ist stumm geblieben. Prüfe, ob das richtige Mikrofon aktiv ist.'
          : describeAiError(err),
      )
    } finally {
      if (alive.current) setState('idle')
    }
  }, [opts])

  const toggle = useCallback(() => {
    if (opts.disabled) return
    setError('')

    if (state === 'listening') {
      dictation.current?.stop()
      dictation.current = null
      setInterim('')
      setState('idle')
      return
    }
    if (state === 'recording') {
      void finishRecording()
      return
    }
    if (state === 'transcribing') return

    if (!supported) {
      setError(unsupportedReason)
      return
    }
    if (canDictate) beginDictation()
    else void beginRecording()
  }, [state, supported, unsupportedReason, canDictate, opts, beginDictation, beginRecording, finishRecording])

  const cancel = useCallback(() => {
    dictation.current?.abort()
    dictation.current = null
    recording.current?.cancel()
    recording.current = null
    setInterim('')
    setError('')
    setState('idle')
  }, [])

  return { state, interim, error, supported, unsupportedReason, toggle, cancel }
}

const LABEL: Record<VoiceState, string> = {
  idle: 'Frage sprechen',
  listening: 'Zuhören beenden',
  recording: 'Aufnahme beenden',
  transcribing: 'Wird mitgeschrieben',
}

export function VoiceButton({ voice, disabled }: { voice: VoiceInput; disabled?: boolean }) {
  const active = voice.state === 'listening' || voice.state === 'recording'

  return (
    <button
      type="button"
      aria-label={LABEL[voice.state]}
      aria-pressed={active}
      title={voice.supported ? LABEL[voice.state] : voice.unsupportedReason}
      onClick={voice.toggle}
      disabled={disabled || voice.state === 'transcribing'}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-40',
        active ? 'bg-danger text-white' : 'text-ink-muted active:bg-white/8',
      )}
    >
      {voice.state === 'transcribing' ? (
        <Loader2 size={18} className="animate-spin" />
      ) : active ? (
        <Square size={14} fill="currentColor" />
      ) : (
        <Mic size={20} />
      )}
    </button>
  )
}

/** Zeile über dem Eingabefeld: was gerade passiert und was schiefging */
export function VoiceStatus({ voice }: { voice: VoiceInput }) {
  if (voice.error) {
    return (
      <p className="mb-2 rounded-xl border border-warn/25 bg-warn/10 px-3 py-2 text-[12px] leading-snug text-warn">
        {voice.error}
      </p>
    )
  }

  if (voice.state === 'idle') return null

  const text =
    voice.state === 'transcribing'
      ? 'Die KI schreibt Deine Aufnahme mit …'
      : voice.state === 'recording'
        ? 'Aufnahme läuft – zum Beenden noch einmal tippen.'
        : voice.interim || 'Ich höre zu – sprich einfach los.'

  return (
    <p className="mb-2 flex items-center gap-2 px-1 text-[12px] leading-snug text-ink-muted">
      {voice.state !== 'transcribing' && (
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" />
      )}
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </p>
  )
}
