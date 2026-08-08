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

export async function startPreview(port = 4173) {
  const base = `http://localhost:${port}/meraq-auto-ai/`
  const server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port)],
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
