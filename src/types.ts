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
  color?: string
  createdAt: string
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
