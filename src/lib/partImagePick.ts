/**
 * Auswahl des Bauteilfotos aus den Treffern einer Commons-Suche.
 *
 * Wie bei den Fahrzeugbildern liegt der fehleranfällige Teil in der Auswahl,
 * nicht im Abruf. Deshalb steht sie hier für sich, ohne Netz und ohne weitere
 * Abhängigkeiten prüfbar (`npm run test:partimage`).
 *
 * Der Unterschied zum Fahrzeugbild: Bei einem Bauteil ist der Dateiname oft das
 * Einzige, was das Bild beschreibt, und Commons ist voll von Zeichnungen,
 * Patentskizzen und Ausschnitten fremder Zusammenhänge. Ein falsches Bauteilfoto
 * ist schlimmer als keines – der Nutzer sucht danach an seinem Fahrzeug.
 */

export interface CommonsCandidate {
  /** Dateiname, z. B. "File:Oelfilter.jpg" */
  title: string
  /** Kurzname der Lizenz aus den Metadaten, z. B. "CC BY-SA 4.0" */
  license?: string
  /** Breite und Höhe, soweit bekannt – Panoramen und Streifen taugen nicht */
  width?: number
  height?: number
}

/**
 * Freie Lizenzen, die eine Anzeige mit Namensnennung erlauben.
 * „cc" ohne Trennzeichen, weil CC0 direkt mit einer Ziffer weitergeht.
 */
const FREE_LICENSE = /^(cc|public domain|pd[- ]|gfdl|fal\b|attribution)/i

/** Nicht-kommerzielle Lizenzen sind für eine veröffentlichte App eine Grauzone */
const NON_COMMERCIAL = /\bnc\b|non-?commercial/i

/** Was kein brauchbares Foto eines Bauteils ist */
const NOT_A_PHOTO =
  /(logo|icon|symbol|karte|map|diagram|schema|schaltplan|patent|zeichnung|drawing|graph|chart|animation|\.svg$)/i

/** Wörter ab drei Zeichen, klein geschrieben */
function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((t) => t.length >= 3)
}

function normalized(file: string) {
  return file.replace(/^(Datei|File):/i, '').toLowerCase()
}

/**
 * Wie gut passt eine Datei zum Suchbegriff?
 * Jedes Wort des Suchbegriffs im Dateinamen zählt; ohne Treffer keine Punkte.
 */
export function scoreCandidate(candidate: CommonsCandidate, query: string): number {
  const file = normalized(candidate.title)
  if (!/\.(jpe?g|png)$/i.test(file)) return 0
  if (NOT_A_PHOTO.test(file)) return 0
  const license = candidate.license?.trim() ?? ''
  if (!FREE_LICENSE.test(license) || NON_COMMERCIAL.test(license)) return 0

  const words = tokens(query)
  const hits = words.filter((w) => file.includes(w)).length
  if (!hits) return 0

  let score = hits * 10
  // Ein vollständiger Treffer des Begriffs ist mehr wert als zwei Einzelwörter
  if (file.includes(words.join(''))) score += 5

  // Quadratische Bilder zeigen das Teil, Streifen zeigen meist eine Werkbank
  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height
    if (ratio > 0.5 && ratio < 2.2) score += 3
    else score -= 4
  }
  return score
}

/**
 * Wählt das beste Foto aus – oder keines.
 * Bei Gleichstand gewinnt der frühere Treffer, denn Commons sortiert nach
 * Relevanz.
 */
export function pickPartImage(
  candidates: CommonsCandidate[],
  query: string,
): CommonsCandidate | undefined {
  let best: { candidate: CommonsCandidate; score: number } | undefined
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, query)
    if (score > 0 && (!best || score > best.score)) best = { candidate, score }
  }
  return best?.candidate
}
