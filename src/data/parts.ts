import type { Part, RepairJob } from '../types'

/**
 * Typische Verschleißteile mit Preisniveaus.
 * Die Preise sind Orientierungswerte aus dem deutschen Teilehandel (Stand 2026)
 * und im UI klar als Schätzung gekennzeichnet – kein Live-Preisfeed.
 */
export const PARTS: Part[] = [
  {
    id: 'oil-filter',
    name: 'Ölfilter',
    category: 'Motor',
    partNumber: '11 42 7 787 273',
    offers: [
      { quality: 'Originalteil', priceEur: 42.9 },
      { quality: 'OEM', priceEur: 23.9, note: 'gleicher Hersteller, ohne Markenlogo' },
      { quality: 'Aftermarket', priceEur: 12.9 },
      { quality: 'Gebraucht', priceEur: 0, note: 'bei Filtern nicht sinnvoll' },
    ],
  },
  {
    id: 'brake-pads-front',
    name: 'Bremsbeläge vorne (Satz)',
    category: 'Bremsen',
    partNumber: '34 10 6 888 774',
    offers: [
      { quality: 'Originalteil', priceEur: 189 },
      { quality: 'OEM', priceEur: 118 },
      { quality: 'Aftermarket', priceEur: 64 },
      { quality: 'Gebraucht', priceEur: 0, note: 'sicherheitsrelevant – nur neu verbauen' },
    ],
  },
  {
    id: 'brake-discs-front',
    name: 'Bremsscheiben vorne (Paar)',
    category: 'Bremsen',
    partNumber: '34 10 6 872 084',
    offers: [
      { quality: 'Originalteil', priceEur: 298 },
      { quality: 'OEM', priceEur: 186 },
      { quality: 'Aftermarket', priceEur: 98 },
      { quality: 'Gebraucht', priceEur: 0, note: 'sicherheitsrelevant – nur neu verbauen' },
    ],
  },
  {
    id: 'air-filter',
    name: 'Luftfilter',
    category: 'Motor',
    partNumber: '13 71 8 577 170',
    offers: [
      { quality: 'Originalteil', priceEur: 48 },
      { quality: 'OEM', priceEur: 29 },
      { quality: 'Aftermarket', priceEur: 16 },
      { quality: 'Gebraucht', priceEur: 0 },
    ],
  },
  {
    id: 'cabin-filter',
    name: 'Innenraumfilter (Aktivkohle)',
    category: 'Innenraum',
    partNumber: '64 11 9 237 555',
    offers: [
      { quality: 'Originalteil', priceEur: 56 },
      { quality: 'OEM', priceEur: 34 },
      { quality: 'Aftermarket', priceEur: 18 },
      { quality: 'Gebraucht', priceEur: 0 },
    ],
  },
  {
    id: 'battery-agm',
    name: 'Starterbatterie 80 Ah AGM',
    category: 'Elektrik',
    partNumber: '61 21 8 431 745',
    offers: [
      { quality: 'Originalteil', priceEur: 289 },
      { quality: 'OEM', priceEur: 198 },
      { quality: 'Aftermarket', priceEur: 149 },
      { quality: 'Gebraucht', priceEur: 45, note: 'Restkapazität unbekannt – riskant' },
    ],
  },
  {
    id: 'spark-plug',
    name: 'Zündkerze (Stück)',
    category: 'Motor',
    partNumber: '12 12 0 037 244',
    offers: [
      { quality: 'Originalteil', priceEur: 24 },
      { quality: 'OEM', priceEur: 15 },
      { quality: 'Aftermarket', priceEur: 9 },
      { quality: 'Gebraucht', priceEur: 0 },
    ],
  },
  {
    id: 'wiper-set',
    name: 'Scheibenwischer-Satz',
    category: 'Innenraum',
    partNumber: '61 61 2 447 918',
    offers: [
      { quality: 'Originalteil', priceEur: 72 },
      { quality: 'OEM', priceEur: 46 },
      { quality: 'Aftermarket', priceEur: 24 },
      { quality: 'Gebraucht', priceEur: 0 },
    ],
  },
  {
    id: 'shock-absorber',
    name: 'Stoßdämpfer hinten (Stück)',
    category: 'Fahrwerk',
    partNumber: '33 52 6 866 691',
    offers: [
      { quality: 'Originalteil', priceEur: 245 },
      { quality: 'OEM', priceEur: 168 },
      { quality: 'Aftermarket', priceEur: 92 },
      { quality: 'Gebraucht', priceEur: 55, note: 'Verschleiß schwer prüfbar' },
    ],
  },
  {
    id: 'alternator',
    name: 'Lichtmaschine',
    category: 'Elektrik',
    partNumber: '12 31 7 605 479',
    offers: [
      { quality: 'Originalteil', priceEur: 720 },
      { quality: 'OEM', priceEur: 480 },
      { quality: 'Aftermarket', priceEur: 310 },
      { quality: 'Gebraucht', priceEur: 165, note: 'Austauschteil mit Garantie bevorzugen' },
    ],
  },
  {
    id: 'egr-valve',
    name: 'AGR-Ventil',
    category: 'Abgas',
    partNumber: '11 71 8 508 155',
    offers: [
      { quality: 'Originalteil', priceEur: 480 },
      { quality: 'OEM', priceEur: 320 },
      { quality: 'Aftermarket', priceEur: 185 },
      { quality: 'Gebraucht', priceEur: 90 },
    ],
  },
  {
    id: 'lambda-sensor',
    name: 'Lambdasonde',
    category: 'Abgas',
    partNumber: '11 78 7 589 121',
    offers: [
      { quality: 'Originalteil', priceEur: 215 },
      { quality: 'OEM', priceEur: 142 },
      { quality: 'Aftermarket', priceEur: 78 },
      { quality: 'Gebraucht', priceEur: 0, note: 'Alterung nicht prüfbar' },
    ],
  },
]

export const PART_CATEGORIES = ['Alle', 'Motor', 'Bremsen', 'Elektrik', 'Innenraum', 'Fahrwerk', 'Abgas'] as const

/**
 * Reparaturpositionen mit Arbeitszeitwerten.
 * Die Stundenwerte orientieren sich an üblichen Arbeitswerten;
 * der Stundensatz ist im UI einstellbar (freie Werkstatt ~110 €, Vertragswerkstatt ~170 €).
 */
export const REPAIR_JOBS: RepairJob[] = [
  { id: 'brake-pads-front', name: 'Bremsbeläge vorne wechseln', category: 'Bremsen', laborHours: 1.2, partsMinEur: 64, partsMaxEur: 189 },
  { id: 'brake-full-front', name: 'Bremsbeläge + Scheiben vorne', category: 'Bremsen', laborHours: 1.8, partsMinEur: 162, partsMaxEur: 487 },
  { id: 'brake-pads-rear', name: 'Bremsbeläge hinten wechseln', category: 'Bremsen', laborHours: 1.4, partsMinEur: 58, partsMaxEur: 165 },
  { id: 'oil-service', name: 'Ölservice (Öl + Filter)', category: 'Motor', laborHours: 0.7, partsMinEur: 70, partsMaxEur: 160 },
  { id: 'inspection', name: 'Große Inspektion', category: 'Wartung', laborHours: 2.5, partsMinEur: 120, partsMaxEur: 320 },
  { id: 'timing-belt', name: 'Zahnriemen inkl. Wasserpumpe', category: 'Motor', laborHours: 5.5, partsMinEur: 180, partsMaxEur: 460 },
  { id: 'clutch', name: 'Kupplung erneuern', category: 'Antrieb', laborHours: 7.0, partsMinEur: 320, partsMaxEur: 880 },
  { id: 'alternator', name: 'Lichtmaschine tauschen', category: 'Elektrik', laborHours: 1.8, partsMinEur: 310, partsMaxEur: 720 },
  { id: 'battery', name: 'Batterie tauschen + anlernen', category: 'Elektrik', laborHours: 0.6, partsMinEur: 149, partsMaxEur: 289 },
  { id: 'egr', name: 'AGR-Ventil ersetzen', category: 'Abgas', laborHours: 2.2, partsMinEur: 185, partsMaxEur: 480 },
  { id: 'dpf-clean', name: 'Partikelfilter reinigen', category: 'Abgas', laborHours: 2.0, partsMinEur: 90, partsMaxEur: 260 },
  { id: 'shocks-rear', name: 'Stoßdämpfer hinten (Paar)', category: 'Fahrwerk', laborHours: 1.6, partsMinEur: 184, partsMaxEur: 490 },
  { id: 'ac-service', name: 'Klimaservice inkl. Befüllung', category: 'Komfort', laborHours: 1.0, partsMinEur: 60, partsMaxEur: 140 },
  { id: 'turbo', name: 'Turbolader erneuern', category: 'Motor', laborHours: 6.0, partsMinEur: 780, partsMaxEur: 2100 },
  { id: 'wheel-alignment', name: 'Achsvermessung + Einstellung', category: 'Fahrwerk', laborHours: 1.5, partsMinEur: 0, partsMaxEur: 0 },
]

export const HOURLY_RATES = [
  { label: 'Freie Werkstatt', rate: 110 },
  { label: 'Meisterbetrieb', rate: 140 },
  { label: 'Vertragswerkstatt', rate: 175 },
] as const
