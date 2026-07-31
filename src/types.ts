export type VehicleKind = 'car' | 'motorcycle' | 'truck' | 'bus' | 'van' | 'camper'

export type FuelType = 'Diesel' | 'Benzin' | 'Elektro' | 'Hybrid' | 'Plug-in-Hybrid' | 'LPG' | 'CNG'

export type Transmission = 'Automatik' | 'Schaltgetriebe'

export type Condition = 'sehr gut' | 'gut' | 'befriedigend' | 'reparaturbedürftig'

export interface Vehicle {
  id: string
  kind: VehicleKind
  make: string
  model: string
  variant?: string
  year: number
  mileage: number
  /** Datum der letzten Kilometerstand-Erfassung (ISO) */
  mileageUpdatedAt: string
  vin?: string
  plate?: string
  fuel: FuelType
  transmission: Transmission
  powerKw: number
  bodyType?: string
  firstRegistration?: string
  /** ISO-Datum der nächsten Hauptuntersuchung */
  huDue?: string
  condition: Condition
  /** Neupreis in Euro – Basis der Wertschätzung */
  listPriceNew?: number
  /** Vom Nutzer aufgenommenes Foto als Data-URL */
  photo?: string
  /** Automatisch gefundenes, frei lizenziertes Foto (Wikimedia Commons) */
  webImage?: VehicleWebImage
  /** Suche schon gelaufen? Verhindert, dass es bei jedem Aufruf erneut versucht wird */
  webImageChecked?: boolean
  color?: string
  createdAt: string

  // --- Angaben aus dem Fahrzeugschein, für Steuer- und Kostenrechnung ---
  /** Hubraum in cm³ (Feld P.1) – Basis der Kfz-Steuer */
  displacementCcm?: number
  /** CO₂-Ausstoß in g/km (Feld V.7) – Basis des CO₂-Anteils der Kfz-Steuer */
  co2GramPerKm?: number
  /** Verbrauch in l/100 km bzw. kWh/100 km */
  consumption?: number
  /** Geschätzte Jahresfahrleistung in km – Basis der Kostenrechnung */
  annualKm?: number
  /** Versicherungsbeitrag pro Jahr in Euro, falls bekannt */
  insuranceYearlyEur?: number
}

/** Ein Posten in einem selbst zusammengestellten Kostenvoranschlag */
export interface QuoteItem {
  id: string
  /** Verweis auf die Reparaturposition, falls aus der Liste übernommen */
  jobId?: string
  name: string
  quantity: number
  laborHours: number
  partsMinEur: number
  partsMaxEur: number
}

export interface Quote {
  id: string
  vehicleId: string
  title: string
  createdAt: string
  hourlyRateEur: number
  items: QuoteItem[]
}

/** Ein von der KI im Foto erkanntes Bauteil */
export interface DetectedPart {
  label: string
  /** Position in Prozent der Bildbreite bzw. -höhe */
  x: number
  y: number
  /** Wofür das Teil da ist */
  fn: string
  /** Woran man es im Bild erkennt */
  looksLike: string
  /** Typische Probleme, kurz */
  problems?: string[]
  confidence: 'sicher' | 'wahrscheinlich' | 'unsicher'
}

/**
 * Frei lizenziertes Fahrzeugfoto aus Wikimedia Commons.
 * Urheber und Lizenz gehören zur Nutzungsbedingung und werden im UI angezeigt.
 */
export interface VehicleWebImage {
  /** Verkleinertes Bild, liegt beim Fahrzeug – danach ist kein Netz mehr nötig */
  dataUrl: string
  /** Dateiname auf Commons */
  title: string
  /** Beschreibungsseite der Datei (Nachweis der Lizenz) */
  pageUrl: string
  articleTitle: string
  articleUrl: string
  author: string
  license: string
}

/** Eine gemerkte Foto-Analyse aus dem Teilefinder */
export interface PartScan {
  id: string
  vehicleId: string
  date: string
  /** Kurzbeschreibung der Aufnahme – stammt aus der Szenenbeschreibung der KI */
  title: string
  /** Foto als Data-URL, liegt in IndexedDB */
  fileKey?: string
  parts: DetectedPart[]
  note?: string
}

export type MaintenanceKind =
  | 'oil'
  | 'inspection'
  | 'brake-fluid'
  | 'air-filter'
  | 'cabin-filter'
  | 'spark-plugs'
  | 'timing-belt'
  | 'ac-service'
  | 'tires'
  | 'battery'
  | 'hu'
  | 'chain'
  | 'valve-clearance'
  | 'coolant'
  | 'dpf'
  | 'hv-battery'

export interface MaintenanceItem {
  id: string
  vehicleId: string
  kind: MaintenanceKind
  label: string
  /** Intervall in Kilometern (0 = nur zeitbasiert) */
  intervalKm: number
  /** Intervall in Monaten (0 = nur kilometerbasiert) */
  intervalMonths: number
  lastDoneKm?: number
  lastDoneAt?: string
  note?: string
  /** Vom Nutzer selbst angelegte Position – wird beim Neuaufbau des Plans nicht ersetzt */
  custom?: boolean
  /** Intervall wurde vom Nutzer angepasst – hat Vorrang vor den Standardwerten */
  edited?: boolean
}

export interface ActivityEntry {
  id: string
  vehicleId: string
  /** ISO-Datum */
  date: string
  title: string
  detail?: string
  icon: 'oil' | 'invoice' | 'diagnosis' | 'reminder' | 'document' | 'mileage' | 'repair'
  costEur?: number
  mileage?: number
}

export type DtcSeverity = 'info' | 'warn' | 'critical'

export interface DiagnosisEntry {
  id: string
  vehicleId: string
  date: string
  code: string
  title: string
  severity: DtcSeverity
  system: string
  /** KI-Erklärung, falls abgerufen */
  explanation?: string
  resolved: boolean
}

export type DocumentCategory =
  | 'Fahrzeugschein'
  | 'Fahrzeugbrief'
  | 'HU-Bericht'
  | 'Rechnung'
  | 'Serviceheft'
  | 'Versicherung'
  | 'Garantie'
  | 'Kaufvertrag'
  | 'Sonstiges'

export interface VehicleDocument {
  id: string
  vehicleId: string
  title: string
  category: DocumentCategory
  date: string
  /** Ablaufdatum (z. B. HU, Versicherung) */
  expiresAt?: string
  /** Bild als Data-URL, in IndexedDB abgelegt */
  fileKey?: string
  mimeType?: string
  note?: string
  /** Von der KI ausgelesene Zusammenfassung */
  extracted?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Data-URL eines mitgeschickten Bildes */
  image?: string
  createdAt: string
  /** true während die Antwort noch streamt */
  pending?: boolean
  error?: string
}

export interface ChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface Guide {
  id: string
  title: string
  category: string
  durationMin: number
  difficulty: 'einfach' | 'mittel' | 'schwer'
  tools: string[]
  parts: string[]
  safety?: string
  steps: { title: string; text: string }[]
}

export type PartQuality = 'Originalteil' | 'OEM' | 'Aftermarket' | 'Gebraucht'

export interface PartOffer {
  quality: PartQuality
  priceEur: number
  note?: string
}

export interface Part {
  id: string
  name: string
  category: string
  partNumber: string
  offers: PartOffer[]
  fitsNote?: string
}

export interface RepairJob {
  id: string
  name: string
  category: string
  /** Arbeitszeit in Stunden */
  laborHours: number
  partsMinEur: number
  partsMaxEur: number
  note?: string
}

/**
 * Ein echter Betrieb aus OpenStreetMap.
 *
 * Bewusst getrennt vom Beispiel-Typ `Workshop`: OSM kennt weder Bewertungen noch
 * Stundensätze. Was es nicht gibt, darf hier kein Feld haben – sonst wäre die
 * Versuchung groß, es zu erfinden.
 */
export interface FoundWorkshop {
  id: string
  name: string
  /** OSM-Wert von `shop`, z. B. car_repair oder tyres */
  kind: string
  street?: string
  city?: string
  phone?: string
  website?: string
  /** Öffnungszeiten im OSM-Format, z. B. "Mo-Fr 07:00-17:00" */
  openingHours?: string
  lat: number
  lon: number
  /** Luftlinie ab dem Suchmittelpunkt */
  distanceKm: number
}

/** Letzte erfolgreiche Umkreissuche – damit beim nächsten Öffnen sofort etwas dasteht */
export interface WorkshopSearch {
  at: string
  lat: number
  lon: number
  radiusKm: number
  results: FoundWorkshop[]
}

export interface Workshop {
  id: string
  name: string
  street: string
  city: string
  phone: string
  rating: number
  reviews: number
  lat: number
  lon: number
  specialties: string[]
  hourlyRateEur: number
  /** zur Laufzeit berechnet */
  distanceKm?: number
}

export interface ManualZone {
  id: string
  label: string
  /** Hintergrund-Illustration als Komponentenschlüssel */
  scene: 'engine' | 'interior' | 'chassis'
  hotspots: ManualHotspot[]
}

export interface ManualHotspot {
  id: string
  label: string
  /** Position in Prozent der Szene */
  x: number
  y: number
  fn: string
  problems: string[]
  interval?: string
}
