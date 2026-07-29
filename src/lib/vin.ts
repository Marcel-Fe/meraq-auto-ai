/**
 * Fahrgestellnummer (VIN) offline auswerten.
 *
 * Genormt sind nach ISO 3779/3780 nur zwei Dinge zuverlässig: die ersten drei
 * Stellen (WMI = Hersteller und Herstellungsland) und – bei Herstellern, die sich
 * daran halten – die zehnte Stelle als Modelljahr.
 *
 * Bewusst NICHT ausgewertet wird die elfte Stelle (Werk): Sie ist herstellerintern
 * vergeben, es gibt keine öffentliche Norm dafür. Eine Zuordnung wäre geraten.
 * Aus demselben Grund steht hier keine Baureihe – dafür fragt die App die KI.
 */

export interface VinInfo {
  /** Eingabe in Großbuchstaben, ohne Leerzeichen */
  vin: string
  /** 17 Stellen und keine unzulässigen Zeichen */
  valid: boolean
  /** Was an der Eingabe nicht stimmt – für den Nutzer formuliert */
  problems: string[]
  manufacturer?: string
  country?: string
  /** Wahrscheinliches Modelljahr aus Stelle 10 */
  modelYear?: number
}

/**
 * Weltherstellercodes (WMI). Nur Einträge, die eindeutig belegt sind –
 * eine falsche Marke im Formular wäre schlimmer als gar keine.
 */
const WMI: Record<string, { make: string; country: string }> = {
  // Deutschland
  WVW: { make: 'Volkswagen', country: 'Deutschland' },
  WV1: { make: 'Volkswagen', country: 'Deutschland' },
  WV2: { make: 'Volkswagen', country: 'Deutschland' },
  WAU: { make: 'Audi', country: 'Deutschland' },
  WA1: { make: 'Audi', country: 'Deutschland' },
  WUA: { make: 'Audi', country: 'Deutschland' },
  WBA: { make: 'BMW', country: 'Deutschland' },
  WBS: { make: 'BMW', country: 'Deutschland' },
  WBY: { make: 'BMW', country: 'Deutschland' },
  WB1: { make: 'BMW Motorrad', country: 'Deutschland' },
  WMW: { make: 'MINI', country: 'Deutschland' },
  WDB: { make: 'Mercedes-Benz', country: 'Deutschland' },
  WDC: { make: 'Mercedes-Benz', country: 'Deutschland' },
  WDD: { make: 'Mercedes-Benz', country: 'Deutschland' },
  WDF: { make: 'Mercedes-Benz', country: 'Deutschland' },
  W1K: { make: 'Mercedes-Benz', country: 'Deutschland' },
  W1N: { make: 'Mercedes-Benz', country: 'Deutschland' },
  W1V: { make: 'Mercedes-Benz', country: 'Deutschland' },
  WP0: { make: 'Porsche', country: 'Deutschland' },
  WP1: { make: 'Porsche', country: 'Deutschland' },
  WF0: { make: 'Ford', country: 'Deutschland' },
  W0L: { make: 'Opel', country: 'Deutschland' },
  W0V: { make: 'Opel', country: 'Deutschland' },
  WMA: { make: 'MAN', country: 'Deutschland' },
  WME: { make: 'smart', country: 'Deutschland' },

  // Übriges Europa
  TRU: { make: 'Audi', country: 'Ungarn' },
  TMB: { make: 'Škoda', country: 'Tschechien' },
  TMA: { make: 'Hyundai', country: 'Tschechien' },
  U5Y: { make: 'Kia', country: 'Slowakei' },
  U6Y: { make: 'Kia', country: 'Slowakei' },
  VSS: { make: 'SEAT', country: 'Spanien' },
  VF1: { make: 'Renault', country: 'Frankreich' },
  VF3: { make: 'Peugeot', country: 'Frankreich' },
  VF6: { make: 'Renault Trucks', country: 'Frankreich' },
  VF7: { make: 'Citroën', country: 'Frankreich' },
  VBK: { make: 'KTM', country: 'Österreich' },
  ZFA: { make: 'Fiat', country: 'Italien' },
  ZAR: { make: 'Alfa Romeo', country: 'Italien' },
  ZFF: { make: 'Ferrari', country: 'Italien' },
  ZAM: { make: 'Maserati', country: 'Italien' },
  ZDM: { make: 'Ducati', country: 'Italien' },
  YS3: { make: 'Saab', country: 'Schweden' },
  YV1: { make: 'Volvo', country: 'Schweden' },
  YV2: { make: 'Volvo Trucks', country: 'Schweden' },
  SAL: { make: 'Land Rover', country: 'Großbritannien' },
  SAJ: { make: 'Jaguar', country: 'Großbritannien' },
  SCA: { make: 'Rolls-Royce', country: 'Großbritannien' },
  SB1: { make: 'Toyota', country: 'Großbritannien' },
  SJN: { make: 'Nissan', country: 'Großbritannien' },
  VNK: { make: 'Toyota', country: 'Türkei' },

  // Asien
  JHM: { make: 'Honda', country: 'Japan' },
  JHL: { make: 'Honda', country: 'Japan' },
  JH2: { make: 'Honda', country: 'Japan' },
  JTD: { make: 'Toyota', country: 'Japan' },
  JTE: { make: 'Toyota', country: 'Japan' },
  JTM: { make: 'Toyota', country: 'Japan' },
  JTN: { make: 'Toyota', country: 'Japan' },
  JTH: { make: 'Lexus', country: 'Japan' },
  JN1: { make: 'Nissan', country: 'Japan' },
  JN8: { make: 'Nissan', country: 'Japan' },
  JMB: { make: 'Mitsubishi', country: 'Japan' },
  JM1: { make: 'Mazda', country: 'Japan' },
  JMZ: { make: 'Mazda', country: 'Japan' },
  JF1: { make: 'Subaru', country: 'Japan' },
  JF2: { make: 'Subaru', country: 'Japan' },
  JS1: { make: 'Suzuki', country: 'Japan' },
  JS3: { make: 'Suzuki', country: 'Japan' },
  JYA: { make: 'Yamaha', country: 'Japan' },
  JKA: { make: 'Kawasaki', country: 'Japan' },
  KNA: { make: 'Kia', country: 'Südkorea' },
  KNB: { make: 'Kia', country: 'Südkorea' },
  KND: { make: 'Kia', country: 'Südkorea' },
  KMH: { make: 'Hyundai', country: 'Südkorea' },
  KM8: { make: 'Hyundai', country: 'Südkorea' },

  // Amerika
  '5YJ': { make: 'Tesla', country: 'USA' },
  '7SA': { make: 'Tesla', country: 'USA' },
  LRW: { make: 'Tesla', country: 'China' },
  '1FT': { make: 'Ford', country: 'USA' },
  '1G1': { make: 'Chevrolet', country: 'USA' },
}

/** Erste Stelle → Herstellungsland, nur die eindeutigen Fälle */
const REGION: Record<string, string> = {
  W: 'Deutschland',
  J: 'Japan',
  K: 'Südkorea',
  L: 'China',
  Z: 'Italien',
  '1': 'USA',
  '4': 'USA',
  '5': 'USA',
  '2': 'Kanada',
  '3': 'Mexiko',
  '9': 'Brasilien',
}

/** Stelle 10: Modelljahr. I, O, Q, U, Z und 0 kommen nicht vor. */
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'

export function decodeVin(input: string): VinInfo | null {
  const vin = input.toUpperCase().replace(/[\s-]/g, '')
  if (vin.length < 3) return null

  const problems: string[] = []
  if (/[IOQ]/.test(vin)) {
    problems.push('Enthält I, O oder Q – diese Buchstaben kommen in einer Fahrgestellnummer nicht vor. Meist sind 1 und 0 gemeint.')
  }
  if (/[^A-Z0-9]/.test(vin)) {
    problems.push('Enthält Zeichen, die in einer Fahrgestellnummer nicht vorkommen.')
  }
  if (vin.length !== 17) {
    problems.push(`Hat ${vin.length} statt 17 Stellen.`)
  }

  const wmi = WMI[vin.slice(0, 3)]
  const info: VinInfo = {
    vin,
    valid: problems.length === 0,
    problems,
    manufacturer: wmi?.make,
    country: wmi?.country ?? REGION[vin[0]],
  }

  if (vin.length === 17) {
    const year = modelYear(vin[9])
    if (year) info.modelYear = year
  }

  return info
}

/**
 * Modelljahr aus dem Code der zehnten Stelle.
 *
 * Der Code wiederholt sich alle 30 Jahre – deshalb wird das jüngste Jahr
 * genommen, das nicht in der Zukunft liegt. Für ein 40 Jahre altes Fahrzeug
 * liefert das die falsche Runde; deshalb ist der Wert im UI als Vorschlag
 * gekennzeichnet und nicht als Tatsache.
 */
function modelYear(code: string): number | undefined {
  const index = YEAR_CODES.indexOf(code)
  if (index < 0) return undefined
  const base = 1980 + index
  const now = new Date().getFullYear()
  let year = base
  while (year + 30 <= now + 1) year += 30
  return year
}
