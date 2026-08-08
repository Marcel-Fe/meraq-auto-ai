/**
 * Die vollständige Absicherung in einem Lauf.
 *
 * Der Vorschau-Server wird einmal gestartet und an alle Prüfskripte
 * weitergereicht – jedes einzeln zu starten kostet je 10 Sekunden Anlauf, und
 * ein daneben laufender Hintergrund-Server stirbt in dieser Umgebung.
 *
 * Was vorher passieren muss: `npm run build`. Ohne frisches dist/ prüft der Lauf
 * einen alten Stand.
 *
 * Aufruf: npm run verify
 */
import { spawn } from 'node:child_process'
import { startPreview } from './preview-server.mjs'

/** Braucht kein Netz und keinen Server – läuft zuerst, weil es Sekunden dauert */
const PURE = [
  ['Rechenkerne', ['--experimental-strip-types', '--import', './scripts/ts-resolve.mjs', 'scripts/test-calc.mjs']],
  ['Kalender-Datei', ['--experimental-strip-types', '--import', './scripts/ts-resolve.mjs', 'scripts/test-ics.mjs']],
  ['Kostenrahmen', ['--experimental-strip-types', '--import', './scripts/ts-resolve.mjs', 'scripts/test-part-cost.mjs']],
  ['Fahrzeugbild', ['--experimental-strip-types', 'scripts/test-vehicle-image.mjs']],
]

/** Über die Oberfläche – bekommt die Adresse des laufenden Servers */
const UI = [
  ['Smoke-Test', 'scripts/smoke-test.mjs'],
  ['Fahrzeugtypen', 'scripts/test-vehicles.mjs'],
  ['KI-Anbieter', 'scripts/test-ai-providers.mjs'],
  ['Werkstattsuche', 'scripts/test-workshops.mjs'],
  ['Bauteil-Suche', 'scripts/test-part-search.mjs'],
]

const failed = []

function run(name, args) {
  return new Promise((resolve) => {
    console.log(`\n=== ${name} ===`)
    const child = spawn(process.execPath, args, { stdio: 'inherit' })
    child.on('exit', (code) => {
      if (code !== 0) failed.push(name)
      resolve()
    })
  })
}

for (const [name, args] of PURE) await run(name, args)

const preview = await startPreview(4173)
try {
  for (const [name, script] of UI) await run(name, [script, preview.base])
} finally {
  preview.stop()
}

console.log('\n========================================')
if (failed.length) {
  console.log(`FEHLGESCHLAGEN: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`OK – alle ${PURE.length + UI.length} Prüfungen bestanden.`)
