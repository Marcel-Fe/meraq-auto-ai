import type { ManualHotspot, PartWebImage } from '../types'
import { getFile, putFile } from './fileStore'
import { pickPartImage, type CommonsCandidate } from './partImagePick'

/**
 * Foto zu einem Bauteil aus freien Quellen.
 *
 * „Wo sitzt es" beantwortet das 3D-Modell, „wie sieht es aus" nur ein echtes
 * Bild. Herstellerfotos sind geschützt; Wikimedia Commons enthält frei
 * lizenzierte Aufnahmen, die mit Urheber und Lizenz gezeigt werden dürfen –
 * genau diese Angaben holt die Abfrage mit.
 *
 * Gesucht wird mit `imageQuery` des Bauteils, nicht mit seinem Anzeigenamen:
 * „Kühlmittel-Ausgleichsbehälter" findet auf Commons nichts, „Ausgleichsbehälter
 * Kühlmittel Auto" schon.
 *
 * Jedes Ergebnis wird verkleinert in IndexedDB abgelegt – auch der Misserfolg.
 * Sonst läuft jedes Öffnen des Bauteil-Sheets erneut ins Netz.
 */

const COMMONS = 'https://commons.wikimedia.org/w/api.php'
const CACHE_PREFIX = 'part-image:'
/** Version im Schlüssel: Ändert sich die Auswahl-Logik, sind alte Treffer wertlos */
const CACHE_VERSION = 'v1'

interface CommonsPage {
  title?: string
  index?: number
  imageinfo?: {
    thumburl?: string
    url?: string
    descriptionurl?: string
    thumbwidth?: number
    thumbheight?: number
    extmetadata?: Record<string, { value?: string }>
  }[]
}

/** HTML aus den Metadaten in reinen Text wandeln – Artist kommt als Link-Markup */
function plainText(html?: string) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function cacheKey(hotspot: ManualHotspot) {
  return `${CACHE_PREFIX}${CACHE_VERSION}:${hotspot.id}`
}

/** Was gesucht wird: der gepflegte Begriff, sonst der Anzeigename */
export function searchTermFor(hotspot: ManualHotspot) {
  return (hotspot.imageQuery ?? hotspot.label).trim()
}

/** Für diese Sitzung merken – dasselbe Sheet öffnet man mehrmals */
const memory = new Map<string, PartWebImage | null>()

export async function findPartImage(
  hotspot: ManualHotspot,
  signal?: AbortSignal,
): Promise<PartWebImage | null> {
  const key = cacheKey(hotspot)
  if (memory.has(key)) return memory.get(key) ?? null

  const stored = await getFile(key).catch(() => undefined)
  if (stored) {
    // Ein leeres Objekt merkt sich: hier gibt es nichts zu holen
    const parsed = JSON.parse(stored) as PartWebImage | Record<string, never>
    const result = 'dataUrl' in parsed ? (parsed as PartWebImage) : null
    memory.set(key, result)
    return result
  }

  const found = await search(hotspot, signal)
  memory.set(key, found)
  await putFile(key, JSON.stringify(found ?? {})).catch(() => undefined)
  return found
}

async function search(hotspot: ManualHotspot, signal?: AbortSignal): Promise<PartWebImage | null> {
  const term = searchTermFor(hotspot)
  const url =
    `${COMMONS}?action=query&format=json&origin=*&generator=search` +
    `&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=12` +
    `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640`

  let pages: CommonsPage[]
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
    pages = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
  } catch {
    return null
  }

  const candidates: CommonsCandidate[] = pages.map((p) => ({
    title: p.title ?? '',
    license: plainText(p.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value),
    width: p.imageinfo?.[0]?.thumbwidth,
    height: p.imageinfo?.[0]?.thumbheight,
  }))

  const chosen = pickPartImage(candidates, term)
  if (!chosen) return null

  const page = pages.find((p) => p.title === chosen.title)
  const info = page?.imageinfo?.[0]
  const src = info?.thumburl ?? info?.url
  if (!src) return null

  try {
    const res = await fetch(src, { signal })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const dataUrl = await shrink(blob)
    return {
      dataUrl,
      title: chosen.title.replace(/^(Datei|File):/i, ''),
      pageUrl: info?.descriptionurl ?? '',
      author: plainText(info?.extmetadata?.Artist?.value) || 'unbekannt',
      license: chosen.license ?? '',
    }
  } catch {
    return null
  }
}

/**
 * Auf 640 px verkleinern. Eigene Funktion statt `fileToDataUrl`, weil dort ein
 * File erwartet wird und hier ein Blob aus dem Netz kommt – der Umweg über eine
 * Datei bringt nichts.
 */
async function shrink(blob: Blob): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = raw
  })

  const scale = Math.min(1, 640 / Math.max(img.width, img.height))
  if (scale === 1 && raw.length < 300_000) return raw

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
