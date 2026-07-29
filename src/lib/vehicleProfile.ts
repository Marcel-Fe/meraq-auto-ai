import type { Vehicle, VehicleKind } from '../types'

/**
 * Fahrzeugprofil – die Grundlage dafür, dass die App für jedes Fahrzeug rechnet
 * und nicht nur für das Demo-Modell.
 *
 * Aus Marke, Fahrzeugart und Leistung werden zwei Faktoren abgeleitet:
 *  - `partsFactor`  wie teuer Ersatzteile im Vergleich zur Kompaktklasse sind
 *  - `laborFactor`  wie viel länger die Arbeit dauert (Zugänglichkeit, Größe)
 *
 * Referenz (Faktor 1,0) ist ein Kompaktwagen einer Volumenmarke, z. B. VW Golf.
 * Die Faktoren sind Erfahrungswerte und werden im UI immer als Schätzung gekennzeichnet.
 */

export type BrandTier = 'budget' | 'volumen' | 'premium' | 'luxus'

export interface VehicleProfile {
  brandTier: BrandTier
  brandLabel: string
  sizeLabel: string
  partsFactor: number
  laborFactor: number
  /** Grober Neupreis pro kW – Basis der Wertschätzung, wenn der Nutzer keinen Neupreis kennt */
  pricePerKw: number
}

/** Marken nach Preisniveau der Ersatzteile. Unbekannte Marken gelten als Volumenmarke. */
const BRAND_TIERS: Record<BrandTier, string[]> = {
  budget: ['dacia', 'lada', 'ssangyong', 'mg', 'suzuki', 'chery', 'byd', 'seat', 'skoda'],
  volumen: [
    'vw', 'volkswagen', 'opel', 'ford', 'renault', 'peugeot', 'citroen', 'citroën', 'fiat',
    'toyota', 'honda', 'nissan', 'mazda', 'hyundai', 'kia', 'mitsubishi', 'subaru', 'chevrolet',
    'yamaha', 'kawasaki', 'iveco', 'man', 'daf',
  ],
  premium: [
    'bmw', 'mercedes', 'mercedes-benz', 'audi', 'volvo', 'lexus', 'jaguar', 'land rover',
    'alfa romeo', 'mini', 'cupra', 'ds', 'tesla', 'polestar', 'ducati', 'ktm', 'triumph',
    'harley-davidson', 'harley davidson', 'bmw motorrad', 'scania', 'setra',
  ],
  luxus: [
    'porsche', 'bentley', 'rolls-royce', 'ferrari', 'lamborghini', 'maserati', 'aston martin',
    'mclaren', 'bugatti', 'lotus',
  ],
}

const TIER_PARTS_FACTOR: Record<BrandTier, number> = {
  budget: 0.72,
  volumen: 1.0,
  premium: 1.45,
  luxus: 2.6,
}

const TIER_LABEL: Record<BrandTier, string> = {
  budget: 'Einstiegsmarke',
  volumen: 'Volumenmarke',
  premium: 'Premiummarke',
  luxus: 'Luxusmarke',
}

/** Neupreis pro kW als grobe Orientierung, wenn kein echter Neupreis hinterlegt ist */
const TIER_PRICE_PER_KW: Record<BrandTier, number> = {
  budget: 175,
  volumen: 230,
  premium: 330,
  luxus: 750,
}

const KIND_FACTORS: Record<VehicleKind, { parts: number; labor: number; label: string }> = {
  car: { parts: 1, labor: 1, label: 'Pkw' },
  motorcycle: { parts: 0.72, labor: 0.85, label: 'Motorrad' },
  van: { parts: 1.25, labor: 1.15, label: 'Transporter' },
  truck: { parts: 2.6, labor: 1.9, label: 'Lkw' },
  bus: { parts: 2.4, labor: 1.85, label: 'Bus' },
  camper: { parts: 1.5, labor: 1.3, label: 'Wohnmobil' },
}

export function brandTierOf(make: string): BrandTier {
  const key = make.trim().toLowerCase()
  for (const [tier, brands] of Object.entries(BRAND_TIERS)) {
    if (brands.some((b) => key === b || key.startsWith(`${b} `))) return tier as BrandTier
  }
  return 'volumen'
}

/** Größere und stärkere Fahrzeuge haben teurere Teile – Bremsen, Reifen, Batterie skalieren mit */
function powerFactor(powerKw: number, kind: VehicleKind) {
  if (kind === 'motorcycle') return 1
  // Referenz: 110 kW (ca. 150 PS). Gedämpft, damit ein 300-kW-Motor nicht das Dreifache kostet.
  return Math.min(1.8, Math.max(0.8, (powerKw / 110) ** 0.45))
}

export function vehicleProfile(v: Vehicle): VehicleProfile {
  const tier = brandTierOf(v.make)
  const kind = KIND_FACTORS[v.kind] ?? KIND_FACTORS.car
  const pf = powerFactor(v.powerKw, v.kind)

  return {
    brandTier: tier,
    brandLabel: TIER_LABEL[tier],
    sizeLabel: kind.label,
    partsFactor: round2(TIER_PARTS_FACTOR[tier] * kind.parts * pf),
    laborFactor: round2(kind.labor * (v.kind === 'car' ? 1 + (pf - 1) * 0.4 : 1)),
    pricePerKw: TIER_PRICE_PER_KW[tier] * (kind.parts > 1.5 ? 1.6 : 1),
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

/* ---------------------------------------------------------------
   Eigenschaften, nach denen Teile, Arbeiten und Anleitungen
   gefiltert werden – damit einem E-Auto kein Ölwechsel und einem
   Diesel keine Zündkerzen angeboten werden.
   --------------------------------------------------------------- */

export interface VehicleTraits {
  hasCombustionEngine: boolean
  hasEngineOil: boolean
  hasSparkPlugs: boolean
  hasDiesel: boolean
  hasParticulateFilter: boolean
  hasCatalyst: boolean
  hasManualClutch: boolean
  hasChainDrive: boolean
  hasCoolant: boolean
  hasTimingBelt: boolean
  hasAirConditioning: boolean
  hasHighVoltageBattery: boolean
  wheelCount: number
}

export function vehicleTraits(v: Vehicle): VehicleTraits {
  const electric = v.fuel === 'Elektro'
  const hybrid = v.fuel === 'Hybrid' || v.fuel === 'Plug-in-Hybrid'
  const diesel = v.fuel === 'Diesel'
  const spark = !electric && !diesel // Benzin, LPG, CNG und Hybrid zünden mit Kerze
  const bike = v.kind === 'motorcycle'

  return {
    hasCombustionEngine: !electric,
    hasEngineOil: !electric,
    hasSparkPlugs: spark,
    hasDiesel: diesel,
    // Partikelfilter: bei Diesel seit 2006 Standard, bei Direkteinspritzer-Benzinern seit 2018
    hasParticulateFilter: (diesel && v.year >= 2006) || (spark && !bike && v.year >= 2018),
    hasCatalyst: !electric,
    hasManualClutch: v.transmission === 'Schaltgetriebe' && !electric,
    hasChainDrive: bike,
    hasCoolant: !bike || v.powerKw > 15,
    // Zahnriemen vs. Steuerkette lässt sich ohne Motorcode nicht sicher sagen – deshalb
    // wird die Position "prüfen" genannt und nicht als sicherer Wechsel dargestellt
    hasTimingBelt: !electric && !bike,
    hasAirConditioning: !bike,
    hasHighVoltageBattery: electric || hybrid,
    wheelCount: bike ? 2 : v.kind === 'truck' || v.kind === 'bus' ? 6 : 4,
  }
}
