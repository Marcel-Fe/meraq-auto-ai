/**
 * Erzeugt die PWA-Icons aus dem Original-Logo im Projektordner.
 * Aufruf: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SRC = '../ChatGPT Image 29. Juli 2026, 11_28_38.png'
const OUT = 'public/icons'

mkdirSync(OUT, { recursive: true })

const meta = await sharp(SRC).metadata()
// Das Quellbild hat einen weißen Rand um das abgerundete App-Icon – wegschneiden
const inset = Math.round(Math.min(meta.width, meta.height) * 0.055)
const buf = await sharp(SRC)
  .extract({
    left: inset,
    top: inset,
    width: meta.width - inset * 2,
    height: meta.height - inset * 2,
  })
  .png()
  .toBuffer()

for (const size of [192, 512]) {
  await sharp(buf).resize(size, size, { fit: 'cover' }).png().toFile(`${OUT}/icon-${size}.png`)
}
await sharp(buf).resize(180, 180, { fit: 'cover' }).png().toFile(`${OUT}/apple-touch-icon.png`)

// Maskable-Variante: Motiv auf 78 % verkleinern, damit Android nichts abschneidet
const inner = await sharp(buf).resize(400, 400, { fit: 'cover' }).png().toBuffer()
await sharp({
  create: { width: 512, height: 512, channels: 4, background: { r: 5, g: 7, b: 13, alpha: 1 } },
})
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(`${OUT}/icon-maskable-512.png`)

console.log('PWA-Icons erstellt in', OUT)
