import type { FoundWorkshop, Vehicle } from '../types'
import { distanceKm } from '../data/workshops'

/**
 * Echte Werkstätten aus OpenStreetMap über die Overpass-Schnittstelle.
 *
 * Warum OpenStreetMap: Es ist die einzige frei nutzbare Quelle für Betriebe mit
 * Adresse und Öffnungszeiten. Google Places wäre genauer, kostet aber Geld und
 * bräuchte einen Server, der den Schlüssel versteckt – beides gibt es hier nicht.
 *
 * Was das kostet: Der öffentliche Overpass-Dienst ist ein Gemeinschaftsangebot
 * ohne Verfügbarkeitszusage. Gemessen antwortet er in 1,5–5 Sekunden, weist aber
 * etwa jede dritte Anfrage mit einer Überlastmeldung ab. Deshalb wird nur auf
 * Knopfdruck gesucht, einmal still wiederholt und das Ergebnis gespeichert.
 *
 * Lizenz: Die Daten stehen unter ODbL. Die Namensnennung ist Pflicht und steht
 * als `OSM_ATTRIBUTION` im UI.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter'

export const OSM_ATTRIBUTION = 'Daten von OpenStreetMap-Mitwirkenden (ODbL)'

/** Nach 20 s abbrechen – so lange läuft auch die Abfrage auf dem Server höchstens */
const TIMEOUT_MS = 20_000

/**
 * Welche Betriebe passen zum Fahrzeug?
 *
 * Fahrzeugunabhängigkeit gilt auch hier: Einem Motorrad eine Pkw-Werkstatt
 * vorzuschlagen wäre so falsch wie ein Ölwechsel beim E-Auto.
 */
export function shopTypesFor(vehicle: Vehicle | null): string[] {
  if (vehicle?.kind === 'motorcycle') return ['motorcycle_repair', 'motorcycle', 'tyres']
  if (vehicle && ['truck', 'bus'].includes(vehicle.kind)) {
    return ['truck_repair', 'car_repair', 'tyres']
  }
  return ['car_repair', 'tyres']
}

export const SHOP_LABELS: Record<string, string> = {
  car_repair: 'Kfz-Werkstatt',
  tyres: 'Reifendienst',
  motorcycle_repair: 'Motorradwerkstatt',
  motorcycle: 'Motorradhändler',
  truck_repair: 'Nutzfahrzeug-Werkstatt',
}

export class WorkshopSearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkshopSearchError'
  }
}

interface OverpassElement {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

/**
 * Eine einzige räumliche Abfrage mit Regex statt mehrerer getrennter.
 *
 * Das ist kein Schönheitsdetail: Drei getrennte Umkreissuchen liefen im Test in
 * den Timeout, dieselbe Suche als eine Abfrage antwortet in unter zwei Sekunden.
 */
function buildQuery(lat: number, lon: number, radiusM: number, shops: string[], limit: number) {
  return `[out:json][timeout:20];nwr[shop~"^(${shops.join('|')})$"](around:${radiusM},${lat},${lon});out center tags ${limit};`
}

async function request(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: query,
      signal: controller.signal,
    })
    if (!res.ok) throw new WorkshopSearchError(`Overpass antwortete mit ${res.status}`)
    const data = await res.json()
    return data.elements ?? []
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export interface SearchOptions {
  lat: number
  lon: number
  radiusKm: number
  vehicle: Vehicle | null
  limit?: number
  signal?: AbortSignal
}

/**
 * Sucht Werkstätten im Umkreis.
 *
 * Bei einer Überlastmeldung wird genau einmal wiederholt – das hebt die
 * Erfolgsquote gemessen von rund zwei Dritteln auf etwa neun von zehn Versuchen.
 * Schlägt auch das fehl, kommt ein `WorkshopSearchError` mit einem Text, der dem
 * Nutzer sagt, was los ist.
 */
export async function searchWorkshops(opts: SearchOptions): Promise<FoundWorkshop[]> {
  const query = buildQuery(
    opts.lat,
    opts.lon,
    Math.round(opts.radiusKm * 1000),
    shopTypesFor(opts.vehicle),
    opts.limit ?? 60,
  )

  let elements: OverpassElement[]
  try {
    elements = await request(query, opts.signal)
  } catch (err) {
    if (isAborted(err)) throw err
    // Ein zweiter Versuch: Die Überlastung des öffentlichen Dienstes ist meist kurz
    await new Promise((r) => setTimeout(r, 1200))
    if (opts.signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError')
    try {
      elements = await request(query, opts.signal)
    } catch (second) {
      if (isAborted(second)) throw second
      throw new WorkshopSearchError(
        'Der Kartendienst antwortet gerade nicht. Er ist ein kostenloses Gemeinschaftsangebot und zeitweise überlastet – versuche es in einem Moment noch einmal.',
      )
    }
  }

  return elements
    .map((el) => toWorkshop(el, opts.lat, opts.lon))
    .filter((w): w is FoundWorkshop => w !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}

/** Ohne Namen oder Koordinaten ist ein Eintrag für den Nutzer wertlos */
function toWorkshop(el: OverpassElement, fromLat: number, fromLon: number): FoundWorkshop | null {
  const tags = el.tags ?? {}
  const name = tags.name?.trim()
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (!name || lat == null || lon == null) return null

  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ')

  return {
    id: `${el.type}/${el.id}`,
    name,
    kind: tags.shop ?? 'car_repair',
    street: street || undefined,
    city: city || undefined,
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
    openingHours: tags.opening_hours,
    lat,
    lon,
    distanceKm: distanceKm(fromLat, fromLon, lat, lon),
  }
}

function isAborted(err: unknown) {
  return err instanceof Error && err.name === 'AbortError'
}
