import { TARGET_SAMPLE_RATE, downsample, encodeWav, isSilent, toMono, wavDataUrl } from './wav'

/**
 * Aufnehmen über das Mikrofon – der Weg, der überall funktioniert.
 *
 * Die Spracherkennung des Geräts (`speech.ts`) ist schneller und kostet nichts,
 * gibt es aber nicht in jedem Browser und in einer installierten Web-App auf
 * dem iPhone nicht zuverlässig. Mikrofon und Aufnahme gibt es dagegen überall,
 * wo die Seite über HTTPS läuft.
 *
 * Was hier bewusst nicht passiert: das Roh-Format weiterreichen. Umgerechnet
 * wird in `wav.ts` – warum, steht dort.
 */

/** Länger als eineinhalb Minuten ist keine Frage mehr, sondern ein Versehen */
export const MAX_RECORDING_SECONDS = 90

export class MicrophoneError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MicrophoneError'
  }
}

export class SilentRecordingError extends Error {
  constructor() {
    super('Die Aufnahme ist stumm geblieben.')
    this.name = 'SilentRecordingError'
  }
}

export interface Recording {
  /** Aufnahme beenden und als WAV-Data-URL zurückgeben */
  stop(): Promise<string>
  /** Abbrechen, ohne etwas zurückzugeben */
  cancel(): void
}

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

/** Das erste Format, das dieser Browser wirklich aufnehmen kann */
function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
}

function describeMicrophoneError(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Das Mikrofon ist nicht freigegeben. Erlaube den Zugriff für diese Seite und versuch es noch einmal.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kein Mikrofon gefunden.'
    case 'NotReadableError':
      return 'Das Mikrofon ist gerade von einer anderen App belegt.'
    default:
      return 'Das Mikrofon lässt sich nicht öffnen.'
  }
}

/**
 * Aufnahme starten. Fragt beim ersten Mal nach der Freigabe des Mikrofons.
 *
 * Rauschunterdrückung und Echoausblendung sind eingeschaltet: Eine Frage wird
 * meist neben einem laufenden Motor oder in einer Garage gestellt.
 */
export async function startRecording(): Promise<Recording> {
  if (!recordingSupported()) {
    throw new MicrophoneError('Dieser Browser kann kein Audio aufnehmen.')
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    })
  } catch (err) {
    throw new MicrophoneError(describeMicrophoneError(err))
  }

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start()

  const release = () => {
    for (const track of stream.getTracks()) track.stop()
  }

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }))
  })

  const limit = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop()
  }, MAX_RECORDING_SECONDS * 1000)

  let done = false

  return {
    async stop() {
      if (done) throw new MicrophoneError('Die Aufnahme wurde bereits beendet.')
      done = true
      clearTimeout(limit)
      if (recorder.state !== 'inactive') recorder.stop()
      const blob = await finished
      release()
      return blobToWavDataUrl(blob)
    },
    cancel() {
      if (done) return
      done = true
      clearTimeout(limit)
      if (recorder.state !== 'inactive') recorder.stop()
      release()
    },
  }
}

/**
 * Aufnahme dekodieren und als WAV ausgeben.
 *
 * Das Dekodieren übernimmt der Browser selbst – er kann genau die Formate
 * lesen, die er vorher geschrieben hat.
 */
export async function blobToWavDataUrl(blob: Blob): Promise<string> {
  const raw = await blob.arrayBuffer()
  if (raw.byteLength === 0) throw new SilentRecordingError()

  const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) throw new MicrophoneError('Dieser Browser kann die Aufnahme nicht umrechnen.')

  const ctx = new Ctx()
  try {
    const decoded = await ctx.decodeAudioData(raw)
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
    const mono = downsample(toMono(channels), decoded.sampleRate, TARGET_SAMPLE_RATE)
    if (isSilent(mono)) throw new SilentRecordingError()
    return wavDataUrl(encodeWav(mono, TARGET_SAMPLE_RATE))
  } finally {
    // Ein offener Audio-Kontext hält das Mikrofon-Symbol im Browser aktiv
    void ctx.close()
  }
}
