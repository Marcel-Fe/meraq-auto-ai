/**
 * Prüft die Rechenteile hinter „Frage sprechen statt tippen": die Umrechnung
 * der Aufnahme in ein Format, das die KI wirklich annimmt, und die Bereinigung
 * des erkannten Textes.
 *
 * Warum das hier steht und nicht nur im Oberflächentest: Der Browser nimmt in
 * `audio/webm` oder `audio/mp4` auf – **beides steht nicht in der Liste der
 * Audioformate, die Google annimmt**. Ein Blob mit falsch behauptetem MIME-Typ
 * würde jeden Test bestehen und in der Wirklichkeit still nichts liefern
 * (siehe lessons.md). Deshalb wird hier der echte WAV-Kopf Byte für Byte
 * geprüft, so wie ihn ein Abspieler liest.
 *
 * Aufruf: npm run test:voice
 */
import {
  SILENCE_THRESHOLD,
  TARGET_SAMPLE_RATE,
  WAV_HEADER_BYTES,
  downsample,
  encodeWav,
  isSilent,
  loudness,
  toMono,
  wavDataUrl,
} from '../src/lib/voice/wav.ts'
import {
  MAX_TRANSCRIPT_CHARS,
  appendTranscript,
  describeSpeechError,
  sanitizeTranscript,
} from '../src/lib/voice/transcript.ts'

const problems = []
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'OK   ' : 'FEHLER'} ${name}${ok || !detail ? '' : ` – ${detail}`}`)
  if (!ok) problems.push(`${name}${detail ? `: ${detail}` : ''}`)
}

const ascii = (view, offset, length) =>
  String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)))

/** Ein Sinuston, wie ihn ein Mikrofon liefern würde */
const tone = (samples, rate, hz = 440, amplitude = 0.5) =>
  Float32Array.from({ length: samples }, (_, i) => amplitude * Math.sin((2 * Math.PI * hz * i) / rate))

console.log('Der WAV-Kopf, so wie ein Abspieler ihn liest')
{
  const samples = tone(1600, TARGET_SAMPLE_RATE)
  const buffer = encodeWav(samples, TARGET_SAMPLE_RATE)
  const view = new DataView(buffer)

  check('Datei beginnt mit RIFF', ascii(view, 0, 4) === 'RIFF', ascii(view, 0, 4))
  check('Typ ist WAVE', ascii(view, 8, 4) === 'WAVE', ascii(view, 8, 4))
  check('fmt-Block ist ausgewiesen', ascii(view, 12, 4) === 'fmt ', ascii(view, 12, 4))
  check('fmt-Block ist 16 Byte lang', view.getUint32(16, true) === 16)
  check('Format 1 = unkomprimiertes PCM', view.getUint16(20, true) === 1)
  check('genau ein Kanal', view.getUint16(22, true) === 1)
  check('Abtastrate steht drin', view.getUint32(24, true) === TARGET_SAMPLE_RATE, `${view.getUint32(24, true)}`)
  check('Byte pro Sekunde passen zur Rate', view.getUint32(28, true) === TARGET_SAMPLE_RATE * 2)
  check('Blockgröße 2 Byte', view.getUint16(32, true) === 2)
  check('16 Bit je Abtastwert', view.getUint16(34, true) === 16)
  check('data-Block ist ausgewiesen', ascii(view, 36, 4) === 'data', ascii(view, 36, 4))
  check('data-Länge stimmt', view.getUint32(40, true) === samples.length * 2)
  check(
    'Gesamtlänge = Kopf + Werte',
    buffer.byteLength === WAV_HEADER_BYTES + samples.length * 2,
    `${buffer.byteLength}`,
  )
  check('RIFF-Länge ist Gesamtlänge minus 8', view.getUint32(4, true) === buffer.byteLength - 8)
}

console.log('\nAbtastwerte')
{
  const buffer = encodeWav(Float32Array.from([0, 0.5, -0.5, 1, -1, 2, -2]), 16000)
  const view = new DataView(buffer)
  const at = (i) => view.getInt16(WAV_HEADER_BYTES + i * 2, true)

  check('Stille bleibt null', at(0) === 0)
  check('halber Ausschlag', at(1) === Math.round(0.5 * 32767), `${at(1)}`)
  check('negativer Ausschlag', at(2) === Math.round(-0.5 * 32767), `${at(2)}`)
  check('Vollausschlag', at(3) === 32767 && at(4) === -32767)
  check('Übersteuerung wird abgeschnitten, nicht umgeklappt', at(5) === 32767 && at(6) === -32767, `${at(5)}/${at(6)}`)
}

console.log('\nHerunterrechnen auf 16 kHz')
{
  const original = tone(48000, 48000)
  const reduced = downsample(original, 48000, TARGET_SAMPLE_RATE)
  check('eine Sekunde bleibt eine Sekunde', reduced.length === TARGET_SAMPLE_RATE, `${reduced.length}`)
  check('das Signal bleibt hörbar', !isSilent(reduced), `${loudness(reduced).toFixed(4)}`)

  const gleich = downsample(original, 16000, 16000)
  check('gleiche Rate = unverändert', gleich === original)
  check('höhere Zielrate wird nicht hochgerechnet', downsample(original, 8000, 16000) === original)

  // Gemittelt statt jeden dritten Wert genommen: Beim einfachen Weglassen
  // entstehen Störtöne, die die Erkennung hörbar schlechter machen
  const rampe = Float32Array.from({ length: 9 }, (_, i) => i / 10)
  const gemittelt = downsample(rampe, 3, 1)
  check('es wird gemittelt, nicht weggelassen', Math.abs(gemittelt[0] - 0.1) < 1e-6, `${gemittelt[0]}`)
}

console.log('\nKanäle zusammenmischen')
{
  const links = Float32Array.from([1, 0, -1])
  const rechts = Float32Array.from([0, 0, 1])
  const mono = toMono([links, rechts])
  check('Mittelwert beider Kanäle', mono[0] === 0.5 && mono[1] === 0 && mono[2] === 0, `${Array.from(mono)}`)
  check('ein Kanal bleibt, wie er ist', toMono([links]) === links)
  check('ohne Kanäle kein Absturz', toMono([]).length === 0)

  const kurz = toMono([Float32Array.from([1, 1, 1]), Float32Array.from([0, 0])])
  check('unterschiedlich lange Kanäle enden am kürzeren', kurz.length === 2, `${kurz.length}`)
}

console.log('\nStille erkennen, bevor sie Kontingent kostet')
{
  check('digitale Stille ist still', isSilent(new Float32Array(16000)))
  check('Grundrauschen ist still', isSilent(tone(16000, 16000, 440, SILENCE_THRESHOLD / 2)))
  check('gesprochene Lautstärke ist nicht still', !isSilent(tone(16000, 16000, 440, 0.2)))
  check('leere Aufnahme ist still', isSilent(new Float32Array(0)))
}

console.log('\nData-URL für die Schnittstelle')
{
  const samples = Float32Array.from([0, 0.25, -0.25])
  const url = wavDataUrl(encodeWav(samples, TARGET_SAMPLE_RATE))
  check('MIME-Typ ist audio/wav', url.startsWith('data:audio/wav;base64,'), url.slice(0, 30))

  const bytes = Buffer.from(url.split(',')[1], 'base64')
  check('Länge übersteht die Kodierung', bytes.length === WAV_HEADER_BYTES + samples.length * 2, `${bytes.length}`)
  check('dekodiert steht wieder RIFF am Anfang', bytes.subarray(0, 4).toString('latin1') === 'RIFF')
  check('dekodiert steht WAVE drin', bytes.subarray(8, 12).toString('latin1') === 'WAVE')

  // Über 32.767 Zeichen sprengt String.fromCharCode(...) den Aufrufstapel –
  // eine echte Aufnahme ist um ein Vielfaches länger
  const lang = wavDataUrl(encodeWav(new Float32Array(200_000), TARGET_SAMPLE_RATE))
  check('eine lange Aufnahme sprengt den Aufrufstapel nicht', lang.length > 500_000, `${lang.length}`)
}

console.log('\nErkannten Text bereinigen')
{
  check('Leerraum fällt weg', sanitizeTranscript('  Was kostet   ein Bremsenwechsel?  ') === 'Was kostet ein Bremsenwechsel?')
  check('Verpackung "Transkription:" fliegt raus', sanitizeTranscript('Transkription: Wann ist die HU fällig?') === 'Wann ist die HU fällig?')
  check('"Der Nutzer sagt:" fliegt raus', sanitizeTranscript('Der Nutzer sagt: Mein Auto ruckelt.') === 'Mein Auto ruckelt.')
  check('umschließende Anführungszeichen fliegen raus', sanitizeTranscript('„Wie wechsle ich das Öl?“') === 'Wie wechsle ich das Öl?')
  check(
    'ein Zitat mitten im Satz bleibt stehen',
    sanitizeTranscript('Die Werkstatt sagte "Zahnriemen fällig" zu mir') ===
      'Die Werkstatt sagte "Zahnriemen fällig" zu mir',
    sanitizeTranscript('Die Werkstatt sagte "Zahnriemen fällig" zu mir'),
  )
  check('Einschub [unverständlich] fliegt raus', sanitizeTranscript('Mein [unverständlich] Auto ruckelt') === 'Mein Auto ruckelt')

  check('"unverständlich" allein heißt: nichts übernehmen', sanitizeTranscript('(unverständlich)') === '')
  check('"nichts gehört" heißt: nichts übernehmen', sanitizeTranscript('Nichts gehört.') === '')
  check('englische Leermeldung ebenso', sanitizeTranscript('[inaudible]') === '')
  check('leerer Text bleibt leer', sanitizeTranscript('   ') === '')
  check('kein String = leer', sanitizeTranscript(undefined) === '' && sanitizeTranscript(42) === '')

  const lang = sanitizeTranscript('a'.repeat(MAX_TRANSCRIPT_CHARS + 500))
  check('zu langer Text wird gekappt', lang.length === MAX_TRANSCRIPT_CHARS, `${lang.length}`)
}

console.log('\nGesprochenes anhängen statt ersetzen')
{
  check('an vorhandenen Text anhängen', appendTranscript('Was kostet', 'ein Ölwechsel?') === 'Was kostet ein Ölwechsel?')
  check('kein doppeltes Leerzeichen', appendTranscript('Was kostet ', ' ein Ölwechsel?') === 'Was kostet ein Ölwechsel?')
  check('leeres Feld übernimmt direkt', appendTranscript('', 'Hallo') === 'Hallo')
  check('leerer Zusatz ändert nichts', appendTranscript('Hallo', '   ') === 'Hallo')
}

console.log('\nFehler der Geräte-Spracherkennung')
{
  check('fehlende Freigabe wird erklärt', describeSpeechError('not-allowed').includes('freigegeben'))
  check('kein Mikrofon wird erklärt', describeSpeechError('audio-capture').includes('Mikrofon'))
  check('nichts gehört wird erklärt', describeSpeechError('no-speech').includes('nichts gehört'))
  check('Netzfehler wird erklärt', describeSpeechError('network').includes('Internetverbindung'))
  check('fehlendes Deutsch verweist auf die Aufnahme', describeSpeechError('language-not-supported').includes('Aufnahme'))
  check('ein Abbruch ist keine Fehlermeldung', describeSpeechError('aborted') === '')
  check('unbekannter Code bekommt trotzdem einen Satz', describeSpeechError('irgendwas').length > 20)
}

if (problems.length) {
  console.log('\nPROBLEME:')
  for (const p of problems) console.log(' -', p)
  process.exit(1)
}
console.log('\nOK – Aufnahme wird korrekt umgerechnet und erkannter Text sauber übernommen.')
