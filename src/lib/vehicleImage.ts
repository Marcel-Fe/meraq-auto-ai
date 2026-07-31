import type { Vehicle, VehicleWebImage } from '../types'
import { fileToDataUrl } from './fileStore'

/**
 * Fahrzeugbild aus freien Quellen.
 *
 * Pressefotos der Hersteller sind urheberrechtlich geschützt – die darf die App
 * nicht anzeigen. Wikimedia Commons enthält dagegen frei lizenzierte Fotos
 * (meist CC BY-SA), die mit Urheber- und Lizenzangabe verwendet werden dürfen.
 * Genau diese Angaben holt die Abfrage mit und die App zeigt sie am Bild an.
 *
 * Das gefundene Bild wird einmal geladen, verkleinert und beim Fahrzeug
 * gespeichert. Danach braucht die App dafür kein Netz mehr – das Versprechen
 * „Daten bleiben auf dem Gerät" bleibt gewahrt.
 */

const WIKIPEDIA = 'https://de.wikipedia.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'

interface WikipediaSearchResult {
  query?: {
    pages?: Record<
      string,
      { title?: string; pageimage?: string; fullurl?: string; index?: number; missing?: string }
    >
  }
}

interface FileInfo {
  thumburl?: string
  url?: string
  descriptionurl?: string
  extmetadata?: Record<string, { value?: string }>
}

interface CommonsImageResult {
  query?: { pages?: Record<string, { imageinfo?: FileInfo[] }> }
}

/**
 * Suchbegriffe in absteigender Genauigkeit.
 *
 * Die Variante („G20 Limousine") trifft die richtige Baureihe deutlich besser –
 * ohne sie landet man leicht beim Vorgängermodell. Findet sie nichts, wird mit
 * Marke und Modell nachgefasst.
 */
function searchTerms(vehicle: Vehicle): string[] {
  const base = `${vehicle.make} ${vehicle.model}`.replace(/\s+/g, ' ').trim()
  const variant = vehicle.variant?.trim()
  const terms = variant ? [`${base} ${variant}`, `${vehicle.make} ${variant}`, base] : [base]
  return [...new Set(terms.filter(Boolean))]
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
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

/** Schlüssel je Modell – gleiche Marke und Modell brauchen nur eine Abfrage */
export function imageKey(vehicle: Vehicle) {
  return `${vehicle.make}|${vehicle.model}|${vehicle.variant ?? ''}`.toLowerCase().trim()
}

/**
 * Ergebnisse für diese Sitzung merken. Beim Nachschlagen fremder Fahrzeuge tippt
 * der Nutzer laufend – ohne Zwischenspeicher liefe jede Eingabe ins Netz.
 */
const cache = new Map<string, VehicleWebImage | null>()

/**
 * Sucht ein frei lizenziertes Foto zum Fahrzeug.
 * Gibt null zurück, wenn nichts Passendes gefunden wird – nie einen Fehler.
 */
export async function findVehicleImage(
  vehicle: Vehicle,
  signal?: AbortSignal,
): Promise<VehicleWebImage | null> {
  const key = imageKey(vehicle)
  if (cache.has(key)) return cache.get(key) ?? null
  const found = await searchVehicleImage(vehicle, signal)
  if (cache.size > 20) cache.delete(cache.keys().next().value as string)
  cache.set(key, found)
  return found
}

type WikiPage = {
  title?: string
  pageimage?: string
  fullurl?: string
  index?: number
  /** Von der API gesetzt, wenn es den Artikel gar nicht gibt */
  missing?: string
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Passt der gefundene Artikel überhaupt zum Fahrzeug?
 *
 * Die Volltextsuche liefert sonst Nachbarmodelle – bei „Mercedes-Benz Sprinter"
 * zum Beispiel den Artikel über den Vario. Ein falsches Fahrzeugbild ist
 * schlimmer als gar keins, deshalb wird der Titel geprüft:
 * Das Modell muss vorkommen. Nur bei Modellnamen mit Ziffern („320d", „A4")
 * reicht die Marke – dort heißt der Artikel oft nach der Baureihe („BMW 3er").
 */
function titleFits(title: string | undefined, vehicle: Vehicle) {
  if (!title) return false
  const t = normalize(title)
  const model = normalize(vehicle.model)
  const make = normalize(vehicle.make)
  if (model && t.includes(model)) return true
  const modelHasDigits = /\d/.test(vehicle.model)
  return modelHasDigits && make.length > 0 && t.includes(make)
}

/**
 * Manche Fahrzeugartikel haben kein hinterlegtes Hauptbild – der Sprinter zum
 * Beispiel. Dann werden die Bilder des Artikels durchgesehen und das genommen,
 * dessen Dateiname zum Modell passt. Logos, Karten und Symbole fallen raus.
 */
async function imageFromArticle(title: string, vehicle: Vehicle, signal?: AbortSignal) {
  const url =
    `${WIKIPEDIA}?action=query&format=json&origin=*&titles=${encodeURIComponent(title)}` +
    `&generator=images&gimlimit=30&prop=imageinfo&iiprop=url&redirects=1`
  const data = await getJson<{ query?: { pages?: Record<string, { title?: string }> } }>(url, signal)
  const files = Object.values(data?.query?.pages ?? {})
    .map((p) => p.title ?? '')
    .filter((t) => /\.(jpe?g|png)$/i.test(t))
    .filter((t) => !/(logo|icon|symbol|karte|map|wappen|flagge|commons|disambig|edit)/i.test(t))

  const model = normalize(vehicle.model)
  const matching = files.filter((t) => normalize(t).includes(model))
  return (matching[0] ?? files[0])?.replace(/^(Datei|File):/i, '')
}

async function searchVehicleImage(
  vehicle: Vehicle,
  signal?: AbortSignal,
): Promise<VehicleWebImage | null> {
  // 1. Passenden Wikipedia-Artikel finden
  let page: WikiPage | undefined
  for (const term of searchTerms(vehicle)) {
    // Erst der direkte Artikelaufruf – trifft "Mercedes-Benz Sprinter" genau
    const exact =
      `${WIKIPEDIA}?action=query&format=json&origin=*&titles=${encodeURIComponent(term)}` +
      `&prop=pageimages|info&piprop=name&inprop=url&redirects=1`
    const exactHit = Object.values(
      (await getJson<WikipediaSearchResult>(exact, signal))?.query?.pages ?? {},
    // Achtung: Fehlende Artikel liefert die API mit missing:"" – ein Leerstring,
    // der bei einer reinen Wahrheitsprüfung durchrutschen würde.
    ).find((p) => p.missing === undefined && p.title && titleFits(p.title, vehicle))
    if (exactHit) {
      page = exactHit
      break
    }

    const searchUrl =
      `${WIKIPEDIA}?action=query&format=json&origin=*&generator=search` +
      `&gsrsearch=${encodeURIComponent(term)}&gsrlimit=5&gsrnamespace=0` +
      `&prop=pageimages|info&piprop=name&inprop=url`
    const search = await getJson<WikipediaSearchResult>(searchUrl, signal)
    const pages = Object.values(search?.query?.pages ?? {})
      .filter((p) => titleFits(p.title, vehicle))
      .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    // Ein Artikel mit Hauptbild ist die bessere Wahl als einer ohne
    const best = pages.find((p) => p.pageimage) ?? pages[0]
    if (best) {
      page = best
      break
    }
  }
  if (!page?.title) return null

  if (!page.pageimage) {
    page = { ...page, pageimage: await imageFromArticle(page.title, vehicle, signal) }
  }
  if (!page.pageimage) return null

  // 2. Lizenz und Urheber der Datei nachschlagen – erst bei Commons, dann in der
  //    deutschen Wikipedia: nicht jede Datei liegt auf Commons.
  let info: FileInfo | undefined
  for (const host of [COMMONS, WIKIPEDIA]) {
    const fileUrl =
      `${host}?action=query&format=json&origin=*&titles=${encodeURIComponent(`File:${page.pageimage}`)}` +
      `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900`
    const file = await getJson<CommonsImageResult>(fileUrl, signal)
    const candidate = Object.values(file?.query?.pages ?? {})[0]?.imageinfo?.[0]
    if (candidate?.extmetadata?.LicenseShortName?.value) {
      info = candidate
      break
    }
    if (candidate && !info) info = candidate
  }

  const src = info?.thumburl ?? info?.url
  if (!src) return null

  const meta = info?.extmetadata ?? {}
  const license = plainText(meta.LicenseShortName?.value)
  // Ohne erkennbare freie Lizenz wird das Bild nicht verwendet
  if (!license) return null

  // 3. Bild einmal laden und verkleinert beim Fahrzeug ablegen
  try {
    const res = await fetch(src, { signal })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const dataUrl = await fileToDataUrl(new File([blob], 'vehicle.jpg', { type: blob.type }), 900)
    return {
      dataUrl,
      title: page.pageimage,
      pageUrl: info?.descriptionurl ?? '',
      articleTitle: page.title ?? `${vehicle.make} ${vehicle.model}`,
      articleUrl: page.fullurl ?? '',
      author: plainText(meta.Artist?.value) || 'unbekannt',
      license,
    }
  } catch {
    return null
  }
}
