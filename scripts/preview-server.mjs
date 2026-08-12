/**
 * Startet den Vorschau-Server für die Dauer eines Prüfskripts.
 *
 * Warum nicht `npm run preview` daneben laufen lassen: In dieser Umgebung stirbt
 * ein Hintergrund-Server, sobald weitere Befehle folgen – der Test läuft dann ins
 * Leere. Direkt `vite` starten, nicht `npm.cmd`: Das wirft unter Windows
 * `spawn EINVAL`.
 */
import { spawn } from 'node:child_process'

/**
 * Nimmt eine übergebene Adresse, wenn es sie gibt (dann läuft der Server schon,
 * etwa in `verify.mjs`), sonst startet sie einen eigenen.
 */
export async function ensurePreview(baseFromArgv, port = 4173) {
  if (baseFromArgv) return { base: baseFromArgv, stop: () => {} }
  return startPreview(port)
}

/** Antwortet auf diesem Port schon jemand? */
async function belegt(port) {
  try {
    const res = await fetch(`http://localhost:${port}/meraq-auto-ai/`)
    return res.ok
  } catch {
    return false
  }
}

export async function startPreview(wunschPort = 4173) {
  // Einen belegten Port stillschweigend mitzubenutzen wäre der schlimmste Fall:
  // Der Test liefe gegen einen fremden, womöglich veralteten Stand. Genau so
  // sind einmal alle fünf Oberflächen-Tests auf einen Schlag fehlgeschlagen,
  // ohne dass an der App etwas falsch war. Abgebrochene Läufe hinterlassen hier
  // regelmäßig einen Server – deshalb weicht der neue aus, statt zu scheitern.
  let port = wunschPort
  while (port < wunschPort + 12 && (await belegt(port))) port++
  if (port >= wunschPort + 12) {
    throw new Error(`Kein freier Port ab ${wunschPort} – laufen dort noch alte Vorschau-Server?`)
  }

  const base = `http://localhost:${port}/meraq-auto-ai/`
  const server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'],
    { stdio: 'ignore' },
  )

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(base)
      if (res.ok) return { base, stop: () => server.kill() }
    } catch {
      /* Server ist noch nicht oben */
    }
    await new Promise((r) => setTimeout(r, 300))
  }

  server.kill()
  throw new Error(`Vorschau-Server auf ${base} nicht erreichbar – wurde vorher gebaut?`)
}
