/**
 * Fragt Wikimedia Commons wirklich ab und zeigt, welches Foto jedes Bauteil
 * bekommen würde.
 *
 * Kein Test, sondern ein Realitätscheck: `npm run test:partimage` prüft die
 * Auswahl gegen erfundene Kandidaten, aber nicht, ob die Suchbegriffe in der
 * Praxis etwas finden. Läuft bewusst nicht in `npm run verify` – es geht dabei
 * ins Netz, und Commons ist kein Dienst, den ein Test bei jedem Lauf belasten
 * sollte.
 *
 * Aufruf: npm run check:partimages
 */
import { MANUAL_ZONES } from '../src/data/manual.ts'
import { pickPartImage } from '../src/lib/partImagePick.ts'

const COMMONS = 'https://commons.wikimedia.org/w/api.php'

const plainText = (html) =>
  (html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Alle Bauteile, auch die fahrzeugspezifischen aus den Zonen */
const hotspots = MANUAL_ZONES.flatMap((z) => z.hotspots)

let mitFoto = 0
const ohne = []

for (const hotspot of hotspots) {
  const term = (hotspot.imageQuery ?? hotspot.label).trim()
  const url =
    `${COMMONS}?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=12` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`

  // Commons weist zu schnelle Folgen ab und antwortet dann mit Text statt JSON.
  // Ein Skript darf das nicht als "kein Bild" verbuchen – also abwarten und
  // erneut fragen. Der Api-User-Agent ist bei Wikimedia Pflicht für Skripte.
  let pages = null
  for (let versuch = 1; versuch <= 3 && pages === null; versuch++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Api-User-Agent': 'MERAQ-AUTO-AI-Pruefskript/1.0 (https://github.com/marcel-fe/meraq-auto-ai)',
        },
      })
      const data = await res.json()
      pages = Object.values(data?.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    } catch {
      if (versuch === 3) {
        console.log(`  FEHLER ${hotspot.label}: Commons antwortet auch beim dritten Versuch nicht`)
        break
      }
      await new Promise((r) => setTimeout(r, versuch * 4000))
    }
  }
  if (pages === null) continue

  const candidates = pages.map((p, rank) => ({
    title: p.title ?? '',
    license: plainText(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value),
    width: p.imageinfo?.[0]?.thumbwidth,
    height: p.imageinfo?.[0]?.thumbheight,
    rank,
  }))

  const chosen = pickPartImage(candidates, term)
  if (chosen) {
    mitFoto++
    console.log(`  OK   ${hotspot.label.padEnd(32)} „${term}“`)
    console.log(`       → ${chosen.title.replace(/^File:/, '')} (${chosen.license})`)
  } else {
    ohne.push({ label: hotspot.label, term, gefunden: candidates.length })
    console.log(`  ---  ${hotspot.label.padEnd(32)} „${term}“ – nichts Passendes unter ${candidates.length} Treffern`)
  }

  // Commons ist ein Gemeinschaftsangebot – nicht im Sekundentakt anfragen
  await new Promise((r) => setTimeout(r, 1500))
}

console.log(`\n${mitFoto} von ${hotspots.length} Bauteilen bekommen ein Foto.`)
if (ohne.length) {
  console.log('\nOhne Foto – hier lohnt ein anderer Suchbegriff:')
  for (const o of ohne) console.log(`  ${o.label} – „${o.term}“ (${o.gefunden} Treffer geprüft)`)
}
