/**
 * Aufnahme → WAV, damit die KI sie annimmt.
 *
 * Der Browser nimmt auf, was er will: Chrome liefert `audio/webm;codecs=opus`,
 * Safari `audio/mp4` mit AAC. **Beides steht nicht in der Liste der Formate,
 * die Google für Audio annimmt** (wav, mp3, aiff, aac, ogg, flac). Ein Blob
 * mit falsch behauptetem MIME-Typ wäre genau der Fehler aus lessons.md: Der
 * Test wäre grün, die Wirklichkeit lieferte still nichts.
 *
 * Deshalb wird die Aufnahme hier wirklich umgerechnet – dekodiert über die
 * Audio-Schnittstelle des Browsers, auf ein Mono-Signal gemischt, auf 16 kHz
 * heruntergerechnet und als unkomprimiertes WAV ausgegeben. 16 kHz sind der
 * Standard für Sprache und ergeben rund 32 kB je Sekunde – eine Minute Frage
 * bleibt damit deutlich unter jeder Größengrenze.
 *
 * Ohne Browser prüfbar: `npm run test:voice`.
 */

/** Sprache braucht nicht mehr; alles darüber kostet nur Übertragung */
export const TARGET_SAMPLE_RATE = 16_000

/** Mehrere Kanäle zu einem mischen – ein Mikrofon liefert oft trotzdem Stereo */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0)
  if (channels.length === 1) return channels[0]

  const length = Math.min(...channels.map((c) => c.length))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    out[i] = sum / channels.length
  }
  return out
}

/**
 * Abtastrate senken.
 *
 * Gemittelt statt jeden n-ten Wert genommen: Beim einfachen Weglassen entstehen
 * Störtöne (Aliasing), die eine Erkennung hörbar schlechter machen.
 */
export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (!(from > 0) || !(to > 0) || from <= to) return input

  const ratio = from / to
  const length = Math.floor(input.length / ratio)
  const out = new Float32Array(length)

  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

/** Kopf einer WAV-Datei: 44 Byte vor den eigentlichen Abtastwerten */
export const WAV_HEADER_BYTES = 44

/**
 * Mono-Signal als 16-Bit-PCM-WAV.
 *
 * Bewusst von Hand geschrieben statt mit einer Bibliothek: Es sind vierzig
 * Byte Kopfdaten, und eine weitere Abhängigkeit im Bündel wäre teurer als
 * dieser Code.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + samples.length * 2)
  const view = new DataView(buffer)

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // Länge des fmt-Blocks
  view.setUint16(20, 1, true) // 1 = unkomprimiertes PCM
  view.setUint16(22, 1, true) // ein Kanal
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // Byte pro Sekunde
  view.setUint16(32, 2, true) // Byte pro Abtastwert
  view.setUint16(34, 16, true) // Bit je Abtastwert
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  for (let i = 0; i < samples.length; i++) {
    // Übersteuerung abschneiden, sonst kippt der Wert beim Umrechnen ins Negative
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(s * 32767), true)
  }
  return buffer
}

/**
 * Ist überhaupt etwas gesprochen worden?
 *
 * Eine leere Aufnahme an die KI zu schicken kostet Kontingent und liefert
 * bestenfalls nichts. Gemessen wird der quadratische Mittelwert – Stille am
 * Mikrofon liegt darunter, ein geflüstertes Wort darüber.
 */
export const SILENCE_THRESHOLD = 0.004

export function loudness(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

export function isSilent(samples: Float32Array): boolean {
  return loudness(samples) < SILENCE_THRESHOLD
}

/** WAV-Daten als Data-URL, so wie die KI-Schnittstelle sie erwartet */
export function wavDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // In Blöcken, weil String.fromCharCode bei einigen hunderttausend Argumenten
  // den Aufrufstapel sprengt
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}
