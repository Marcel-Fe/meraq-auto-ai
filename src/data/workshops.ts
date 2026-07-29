import type { Workshop } from '../types'

/**
 * Beispiel-Werkstätten für die Kartenansicht.
 * Es sind bewusst neutrale Namen – keine echten Betriebe, damit keine
 * falschen Öffnungszeiten oder Bewertungen suggeriert werden.
 * Die Entfernung wird zur Laufzeit aus der Geoposition berechnet.
 */
export const WORKSHOPS: Workshop[] = [
  {
    id: 'w1',
    name: 'MERAQ Partnerwerkstatt Mitte',
    street: 'Industriestraße 14',
    city: '80339 München',
    phone: '+49 89 1234567',
    rating: 4.8,
    reviews: 124,
    lat: 48.1351,
    lon: 11.582,
    specialties: ['Inspektion', 'Bremsen', 'Diagnose'],
    hourlyRateEur: 118,
  },
  {
    id: 'w2',
    name: 'Autotechnik Nord',
    street: 'Schleißheimer Str. 220',
    city: '80797 München',
    phone: '+49 89 2345678',
    rating: 4.6,
    reviews: 89,
    lat: 48.171,
    lon: 11.564,
    specialties: ['Motor', 'Getriebe', 'Turbolader'],
    hourlyRateEur: 132,
  },
  {
    id: 'w3',
    name: 'Kfz-Meisterbetrieb Süd',
    street: 'Boschetsrieder Str. 40',
    city: '81379 München',
    phone: '+49 89 3456789',
    rating: 4.9,
    reviews: 213,
    lat: 48.104,
    lon: 11.536,
    specialties: ['Elektrik', 'Klima', 'HU/AU'],
    hourlyRateEur: 145,
  },
  {
    id: 'w4',
    name: 'Reifen & Fahrwerk West',
    street: 'Landsberger Str. 310',
    city: '80687 München',
    phone: '+49 89 4567890',
    rating: 4.4,
    reviews: 67,
    lat: 48.14,
    lon: 11.503,
    specialties: ['Reifen', 'Achsvermessung', 'Fahrwerk'],
    hourlyRateEur: 98,
  },
  {
    id: 'w5',
    name: 'Vertragswerkstatt Ost',
    street: 'Rosenheimer Str. 145',
    city: '81671 München',
    phone: '+49 89 5678901',
    rating: 4.3,
    reviews: 341,
    lat: 48.124,
    lon: 11.606,
    specialties: ['Garantie', 'Software-Update', 'Karosserie'],
    hourlyRateEur: 178,
  },
  {
    id: 'w6',
    name: 'Karosserie & Lack Zentrum',
    street: 'Dachauer Str. 480',
    city: '80993 München',
    phone: '+49 89 6789012',
    rating: 4.7,
    reviews: 156,
    lat: 48.19,
    lon: 11.53,
    specialties: ['Unfallschaden', 'Lackierung', 'Dellen'],
    hourlyRateEur: 125,
  },
]

/** Luftlinie zwischen zwei Koordinaten (Haversine), Ergebnis in Kilometern */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}
