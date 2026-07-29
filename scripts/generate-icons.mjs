/**
 * Erzeugt die PWA-Icons aus dem Markenlogo.
 * Aufruf: node scripts/generate-icons.mjs
 *
 * Quelle ist das Original im übergeordneten Ordner; fehlt es, dient das bereits
 * erzeugte 512er-Icon als Vorlage. So bleibt das Skript auch dann benutzbar,
 * wenn das Original nicht mehr neben dem Projekt liegt.
 */
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'

const ORIGINAL = '../ChatGPT Image 29. Juli 2026, 11_28_38.png'
const OUT = 'public/icons'
const BG = { r: 5, g: 7, b: 13, alpha: 1 } // --color-bg, wie im Manifest

mkdirSync(OUT, { recursive: true })

const src = existsSync(ORIGINAL) ? ORIGINAL : `${OUT}/icon-512.png`

const trimmed = await sharp(src).resize(512, 512, { fit: 'cover' }).png().toBuffer()

/**
 * Die Vorlage ist eine abgerundete Kachel auf weißem Grund. iOS und Android runden
 * das Icon selbst ab – bleibt das Weiß stehen, blitzt es als heller Saum hervor.
 *
 * Deshalb wird das Weiße von den Bildrändern aus geflutet und durch die
 * Hintergrundfarbe ersetzt. Nur zusammenhängend vom Rand erreichbare Pixel werden
 * ersetzt: Der weiße Schriftzug in der Bildmitte bleibt dadurch unberührt.
 */
async function fillOuterWhite(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const isLight = (i) => data[i] > 150 && data[i + 1] > 150 && data[i + 2] > 150

  const seen = new Uint8Array(width * height)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const p = y * width + x
    if (seen[p]) return
    seen[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (stack.length) {
    const p = stack.pop()
    const i = p * channels
    if (!isLight(i)) continue
    data[i] = BG.r
    data[i + 1] = BG.g
    data[i + 2] = BG.b
    data[i + 3] = 255
    const x = p % width
    const y = (p - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer()
}

const square = await sharp(await fillOuterWhite(trimmed)).flatten({ background: BG }).png().toBuffer()

for (const size of [192, 512]) {
  await sharp(square).resize(size, size).png().toFile(`${OUT}/icon-${size}.png`)
}
await sharp(square).resize(180, 180).png().toFile(`${OUT}/apple-touch-icon.png`)

// Maskable-Variante: Motiv auf 78 % verkleinern, damit Android nichts abschneidet
const inner = await sharp(square).resize(400, 400).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(`${OUT}/icon-maskable-512.png`)

console.log('PWA-Icons erstellt in', OUT)
