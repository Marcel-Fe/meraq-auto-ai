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
  /** Platz in der Trefferliste, 0 = erster. Commons sortiert nach Relevanz. */
  rank?: number
}

/**
 * Wörter, die den Fahrzeugbezug herstellen.
 *
 * Ohne sie landete beim „Kombiinstrument" das Cockpit einer Kawasaki Ki-61 –
 * eines Jagdflugzeugs von 1943. Der Dateiname enthielt „instrument", mehr
 * brauchte es nicht.
 */
const AUTOMOTIVE =
  /(car|auto|vehicle|motor|lorry|truck|kfz|pkw|volkswagen|\bvw\b|audi|mercedes|\bbmw\b|opel|ford|skoda|seat|renault|peugeot|citro|fiat|toyota|hyundai|\bkia\b|mazda|nissan|volvo|porsche|tesla|dacia|jeep)/i

/**
 * Jahreszahl im Dateinamen, z. B. „1953 Imperial 2-tone with AC vents".
 *
 * Commons ist ein Archiv: Zum „Stoßdämpfer" gewann eine Zeichnung aus dem
 * Autocar Handbook von 1935. Fachlich richtig, für jemanden mit einem heutigen
 * Auto trotzdem wertlos.
 */
const YEAR = /\b(18|19|20)\d{2}\b/

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
  // „car" allein ist kein Treffer: „FRA T19 car interior.jpg" ist eine
  // Straßenbahn. Das Bauteil muss im Dateinamen stehen, nicht nur das Fahrzeug.
  const specific = words.filter((w) => !AUTOMOTIVE.test(w))
  const hits = (specific.length ? specific : words).filter((w) => file.includes(w)).length
  if (!hits) return 0

  let score = hits * 10
  // Ein vollständiger Treffer des Begriffs ist mehr wert als zwei Einzelwörter
  if (file.includes(words.join(''))) score += 5

  // Fahrzeugbezug im Dateinamen – sonst ist es womöglich ein Flugzeug.
  // Markennamen zählen mit: „The exhaust silencer of Audi TTS" sagt nirgends
  // „car", zeigt aber zweifelsfrei ein Auto.
  if (AUTOMOTIVE.test(file)) score += 12

  // Alte Aufnahmen zeigen ein Bauteil, das es so nicht mehr gibt. Der Abzug
  // wiegt schwerer als der Fahrzeugbonus: Ein Hebeldämpfer von 1935 sieht
  // anders aus als jedes Federbein, das heute in einem Auto steckt.
  const jahr = Number(YEAR.exec(file)?.[0] ?? 0)
  if (jahr && jahr < 1990) score -= 24
  else if (jahr && jahr < 2005) score -= 6

  // Commons sortiert nach Relevanz; die ersten Treffer sind meist die besseren
  if (typeof candidate.rank === 'number') score += Math.max(0, 6 - candidate.rank)

  // Quadratische Bilder zeigen das Teil, Streifen zeigen meist eine Werkbank
  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height
    if (ratio > 0.5 && ratio < 2.2) score += 3
    else score -= 4
  }
  return score
}

/**
 * Ab hier ist ein Treffer gut genug, um ihn zu zeigen.
 *
 * Ein einzelnes zutreffendes Wort ohne Fahrzeugbezug reicht nicht: So gewann
 * zum „Kombiinstrument" das Cockpit einer Kawasaki Ki-61. Die Schwelle
 * entspricht etwa einem Bauteilwort **plus** erkennbarem Fahrzeugbezug – oder
 * zwei zutreffenden Bauteilwörtern.
 */
const MIN_SCORE = 20

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
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { candidate, score }
  }
  return best?.candidate
}
