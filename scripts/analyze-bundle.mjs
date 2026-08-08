/**
 * Zeigt, was im Erststart-Bundle steckt.
 *
 * Der Erststart ist zwischen zwei Commits um 22 kB gewachsen, ohne dass ein
 * Screen dazugekommen wäre. Raten hilft da nicht: Rollup kennt für jeden Chunk
 * die enthaltenen Module samt ihrer Größe im fertigen Bundle
 * (`renderedLength`) – genau das steht hier.
 *
 * Gebaut wird nach dist-analyze/, damit das ausgelieferte dist/ unangetastet
 * bleibt; das Verzeichnis wird danach wieder entfernt.
 *
 * Aufruf: npm run analyze
 */
import { build } from 'vite'
import { rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const OUT = 'dist-analyze'
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`
const gzipKb = (code) => `${(gzipSync(code).length / 1024).toFixed(2)} kB`

const result = await build({
  logLevel: 'warn',
  build: { outDir: OUT, reportCompressedSize: false },
})

const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output ?? [])
const chunks = outputs.filter((o) => o.type === 'chunk')

/** Ein Modul gehört zum Erststart, wenn es im Einstiegs-Chunk liegt */
const entry = chunks.find((c) => c.isEntry)
if (!entry) throw new Error('Kein Einstiegs-Chunk gefunden')

const rows = Object.entries(entry.modules)
  .map(([id, m]) => ({ id: id.replace(process.cwd(), '').replace(/\\/g, '/'), size: m.renderedLength }))
  .filter((r) => r.size > 0)
  .sort((a, b) => b.size - a.size)

const total = rows.reduce((sum, r) => sum + r.size, 0)

console.log(`\nErststart-Chunk: ${entry.fileName} – ${kb(total)} roh, ${rows.length} Module\n`)
console.log('Die 25 größten Module:')
for (const r of rows.slice(0, 25)) {
  console.log(`  ${kb(r.size).padStart(9)}  ${r.id}`)
}

/** Nach Herkunft gruppieren – Abhängigkeiten oder eigener Code? */
const groups = new Map()
for (const r of rows) {
  const key = r.id.includes('node_modules')
    ? `node_modules/${r.id.split('node_modules/')[1].split('/').slice(0, 1).join('/')}`
    : r.id.split('/').slice(0, 3).join('/')
  groups.set(key, (groups.get(key) ?? 0) + r.size)
}

console.log('\nNach Herkunft:')
for (const [key, size] of [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${kb(size).padStart(9)}  ${key}`)
}

/**
 * Der Erststart ist nicht die index-Datei allein.
 *
 * Jeder Chunk, den der Einstieg statisch importiert, wird per `modulepreload`
 * mitgeladen. Genau daran ist die letzte Messung gescheitert: Der Erststart
 * schien um 22 kB gewachsen, tatsächlich war nur React Router aus einem eigenen
 * vorgeladenen Chunk in die index-Datei gewandert.
 */
const byName = new Map(chunks.map((c) => [c.fileName, c]))
const startup = new Set()
const collect = (name) => {
  if (startup.has(name)) return
  startup.add(name)
  for (const imported of byName.get(name)?.imports ?? []) collect(imported)
}
collect(entry.fileName)

console.log('\nBeim Erststart geladen (index plus alles, was er statisch nachzieht):')
let startupGzip = 0
for (const name of startup) {
  const chunk = byName.get(name)
  if (!chunk) continue
  const gz = gzipSync(chunk.code).length
  startupGzip += gz
  console.log(`  ${gzipKb(chunk.code).padStart(9)} gzip  ${name}`)
}
console.log(`  ${'———'.padStart(9)}`)
console.log(`  ${(startupGzip / 1024).toFixed(2).padStart(9)} kB gzip  Erststart gesamt`)

console.log('\nErst bei Bedarf (die größten):')
for (const c of chunks.filter((c) => !startup.has(c.fileName)).sort((a, b) => b.code.length - a.code.length).slice(0, 8)) {
  console.log(`  ${gzipKb(c.code).padStart(9)} gzip  ${c.fileName}`)
}

rmSync(OUT, { recursive: true, force: true })
