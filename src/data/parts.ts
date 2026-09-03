import type { Part, PartQuality, RepairJob, Vehicle } from '../types'
import { vehicleProfile, vehicleTraits, type VehicleTraits } from '../lib/vehicleProfile'

/**
 * Teile und Reparaturpositionen sind als Vorlagen hinterlegt und werden zur Laufzeit
 * auf das konkrete Fahrzeug umgerechnet – sonst würde die App für jedes Auto die
 * Preise eines Mittelklasse-BMW zeigen.
 *
 * Basispreise gelten für einen Kompaktwagen einer Volumenmarke (Referenz: VW Golf).
 * Über `vehicleProfile()` kommt der Faktor für Marke, Fahrzeugart und Leistung dazu.
 *
 * Bewusst OHNE Teilenummern: eine Teilenummer gilt immer nur für eine bestimmte
 * Baureihe und Motorvariante. Eine erfundene Nummer wäre schlimmer als keine –
 * deshalb ermittelt die App sie auf Wunsch über die Fahrgestellnummer per KI.
 */

interface PartTemplate {
  id: string
  name: string
  category: string
  /** Basispreis des Originalteils in Euro (Kompaktklasse, Volumenmarke) */
  basePrice: number
  /** Preisanteil je Qualitätsstufe, bezogen auf das Originalteil */
  ratios?: Partial<Record<PartQuality, number>>
  /** Gebrauchtteil sinnvoll? Sonst wird ein Grund angezeigt */
  usedNote?: string
  /** Wird nur angezeigt, wenn diese Bedingung auf das Fahrzeug zutrifft */
  requires?: (t: VehicleTraits) => boolean
  hint?: string
}

const DEFAULT_RATIOS: Record<PartQuality, number> = {
  Originalteil: 1,
  OEM: 0.64,
  Aftermarket: 0.36,
  Gebraucht: 0.22,
}

const PART_TEMPLATES: PartTemplate[] = [
  {
    id: 'oil-filter',
    name: 'Ölfilter',
    category: 'Motor',
    basePrice: 28,
    usedNote: 'bei Filtern nicht sinnvoll',
    requires: (t) => t.hasEngineOil,
  },
  {
    id: 'engine-oil',
    name: 'Motoröl (5 Liter)',
    category: 'Motor',
    basePrice: 62,
    ratios: { OEM: 0.8, Aftermarket: 0.55 },
    usedNote: 'nicht möglich',
    requires: (t) => t.hasEngineOil,
    hint: 'Nur Öl mit der Freigabe des Herstellers verwenden – die steht im Handbuch.',
  },
  {
    id: 'air-filter',
    name: 'Luftfilter',
    category: 'Motor',
    basePrice: 34,
    usedNote: 'bei Filtern nicht sinnvoll',
    requires: (t) => t.hasCombustionEngine,
  },
  {
    id: 'cabin-filter',
    name: 'Innenraumfilter (Aktivkohle)',
    category: 'Innenraum',
    basePrice: 38,
    usedNote: 'bei Filtern nicht sinnvoll',
    requires: (t) => t.hasAirConditioning,
  },
  {
    id: 'spark-plug',
    name: 'Zündkerze (Stück)',
    category: 'Motor',
    basePrice: 17,
    usedNote: 'Verschleißteil – nur neu',
    requires: (t) => t.hasSparkPlugs,
  },
  {
    id: 'glow-plug',
    name: 'Glühkerze (Stück)',
    category: 'Motor',
    basePrice: 24,
    usedNote: 'Verschleißteil – nur neu',
    requires: (t) => t.hasDiesel,
  },
  {
    id: 'brake-pads-front',
    name: 'Bremsbeläge vorne (Satz)',
    category: 'Bremsen',
    basePrice: 128,
    usedNote: 'sicherheitsrelevant – nur neu verbauen',
  },
  {
    id: 'brake-discs-front',
    name: 'Bremsscheiben vorne (Paar)',
    category: 'Bremsen',
    basePrice: 195,
    usedNote: 'sicherheitsrelevant – nur neu verbauen',
  },
  {
    id: 'brake-pads-rear',
    name: 'Bremsbeläge hinten (Satz)',
    category: 'Bremsen',
    basePrice: 108,
    usedNote: 'sicherheitsrelevant – nur neu verbauen',
  },
  {
    id: 'brake-fluid',
    name: 'Bremsflüssigkeit (1 Liter)',
    category: 'Bremsen',
    basePrice: 18,
    ratios: { OEM: 0.85, Aftermarket: 0.6 },
    usedNote: 'nicht möglich',
  },
  {
    id: 'battery',
    name: 'Starterbatterie',
    category: 'Elektrik',
    basePrice: 175,
    ratios: { OEM: 0.72, Aftermarket: 0.52, Gebraucht: 0.2 },
    usedNote: 'Restkapazität unbekannt – riskant',
  },
  {
    id: 'alternator',
    name: 'Lichtmaschine',
    category: 'Elektrik',
    basePrice: 480,
    ratios: { Gebraucht: 0.28 },
    usedNote: 'Austauschteil mit Garantie bevorzugen',
    requires: (t) => t.hasCombustionEngine,
  },
  {
    id: 'starter',
    name: 'Anlasser',
    category: 'Elektrik',
    basePrice: 330,
    ratios: { Gebraucht: 0.28 },
    usedNote: 'Austauschteil mit Garantie bevorzugen',
    requires: (t) => t.hasCombustionEngine,
  },
  {
    id: 'wiper-set',
    name: 'Scheibenwischer-Satz',
    category: 'Innenraum',
    basePrice: 48,
    usedNote: 'Verschleißteil – nur neu',
    requires: (t) => t.wheelCount > 2,
  },
  {
    id: 'shock-absorber',
    name: 'Stoßdämpfer (Stück)',
    category: 'Fahrwerk',
    basePrice: 165,
    ratios: { Gebraucht: 0.3 },
    usedNote: 'Verschleiß von außen kaum prüfbar',
  },
  {
    id: 'lambda-sensor',
    name: 'Lambdasonde',
    category: 'Abgas',
    basePrice: 145,
    usedNote: 'Alterung nicht prüfbar',
    requires: (t) => t.hasCatalyst,
  },
  {
    id: 'egr-valve',
    name: 'AGR-Ventil',
    category: 'Abgas',
    basePrice: 320,
    ratios: { Gebraucht: 0.25 },
    requires: (t) => t.hasDiesel,
  },
  {
    id: 'dpf',
    name: 'Partikelfilter',
    category: 'Abgas',
    basePrice: 950,
    ratios: { Gebraucht: 0.22 },
    usedNote: 'Beladung unbekannt – meist keine gute Idee',
    requires: (t) => t.hasParticulateFilter,
  },
  {
    id: 'coolant',
    name: 'Kühlmittel (5 Liter, Fertigmischung)',
    category: 'Motor',
    basePrice: 32,
    ratios: { OEM: 0.8, Aftermarket: 0.55 },
    usedNote: 'nicht möglich',
    requires: (t) => t.hasCoolant,
    hint: 'Sorten nicht mischen – die Farbe allein ist kein sicheres Kennzeichen.',
  },
  {
    id: 'clutch-kit',
    name: 'Kupplungssatz',
    category: 'Antrieb',
    basePrice: 420,
    ratios: { Gebraucht: 0.24 },
    usedNote: 'Aufwand beim Einbau zu hoch für ein Gebrauchtteil',
    requires: (t) => t.hasManualClutch,
  },
  {
    id: 'chain-kit',
    name: 'Kettenkit (Kette + Ritzel + Kettenrad)',
    category: 'Antrieb',
    basePrice: 175,
    usedNote: 'Verschleißteil – nur neu',
    requires: (t) => t.hasChainDrive,
  },
  {
    id: 'timing-belt-kit',
    name: 'Zahnriemensatz inkl. Spannrolle',
    category: 'Motor',
    basePrice: 210,
    usedNote: 'sicherheitskritisch – nur neu',
    requires: (t) => t.hasTimingBelt,
  },
  {
    id: 'hv-check',
    name: 'Hochvoltbatterie – Zustandsprüfung',
    category: 'Elektrik',
    basePrice: 130,
    ratios: { OEM: 0.85, Aftermarket: 0.6 },
    usedNote: 'nicht anwendbar',
    requires: (t) => t.hasHighVoltageBattery,
    hint: 'Ein Prüfprotokoll ist beim Verkauf bares Geld wert.',
  },
]

export const PART_CATEGORIES = [
  'Alle',
  'Motor',
  'Bremsen',
  'Elektrik',
  'Innenraum',
  'Fahrwerk',
  'Abgas',
  'Antrieb',
] as const

/** Teile für ein konkretes Fahrzeug: gefiltert und auf dessen Preisniveau umgerechnet */
export function partsFor(vehicle: Vehicle): Part[] {
  const traits = vehicleTraits(vehicle)
  const { partsFactor } = vehicleProfile(vehicle)

  return PART_TEMPLATES.filter((p) => !p.requires || p.requires(traits)).map((p) => {
    const original = p.basePrice * partsFactor
    const ratios = { ...DEFAULT_RATIOS, ...p.ratios }

    const offers = (Object.keys(DEFAULT_RATIOS) as PartQuality[]).map((quality) => {
      const usable = quality !== 'Gebraucht' || !p.usedNote
      return {
        quality,
        priceEur: usable ? roundPrice(original * ratios[quality]) : 0,
        note:
          quality === 'Gebraucht' && p.usedNote
            ? p.usedNote
            : quality === 'OEM'
              ? 'gleicher Hersteller, ohne Markenlogo'
              : undefined,
      }
    })

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      partNumber: '',
      offers,
      fitsNote: p.hint,
    }
  })
}

function roundPrice(v: number) {
  if (v < 30) return Math.round(v * 2) / 2 // auf 50 Cent
  if (v < 200) return Math.round(v)
  return Math.round(v / 5) * 5
}

/* ---------------------------------------------------------------
   Reparaturpositionen
   --------------------------------------------------------------- */

interface JobTemplate {
  id: string
  name: string
  category: string
  /** Arbeitszeit in Stunden für ein Referenzfahrzeug */
  laborHours: number
  /** Ersatzteilkosten-Spanne (Aftermarket bis Original) für das Referenzfahrzeug */
  partsMin: number
  partsMax: number
  requires?: (t: VehicleTraits) => boolean
  note?: string
}

const JOB_TEMPLATES: JobTemplate[] = [
  { id: 'oil-service', name: 'Ölservice (Öl + Filter)', category: 'Motor', laborHours: 0.7, partsMin: 55, partsMax: 120, requires: (t) => t.hasEngineOil },
  { id: 'inspection', name: 'Inspektion (groß)', category: 'Wartung', laborHours: 2.5, partsMin: 90, partsMax: 240 },
  { id: 'brake-pads-front', name: 'Bremsbeläge vorne wechseln', category: 'Bremsen', laborHours: 1.2, partsMin: 46, partsMax: 128 },
  { id: 'brake-full-front', name: 'Bremsbeläge + Scheiben vorne', category: 'Bremsen', laborHours: 1.8, partsMin: 116, partsMax: 323 },
  { id: 'brake-pads-rear', name: 'Bremsbeläge hinten wechseln', category: 'Bremsen', laborHours: 1.4, partsMin: 39, partsMax: 108 },
  { id: 'brake-fluid', name: 'Bremsflüssigkeit wechseln', category: 'Bremsen', laborHours: 0.8, partsMin: 12, partsMax: 22 },
  { id: 'battery', name: 'Starterbatterie tauschen + anlernen', category: 'Elektrik', laborHours: 0.6, partsMin: 92, partsMax: 175 },
  { id: 'alternator', name: 'Lichtmaschine tauschen', category: 'Elektrik', laborHours: 1.8, partsMin: 175, partsMax: 480, requires: (t) => t.hasCombustionEngine },
  { id: 'starter', name: 'Anlasser tauschen', category: 'Elektrik', laborHours: 1.6, partsMin: 120, partsMax: 330, requires: (t) => t.hasCombustionEngine },
  { id: 'spark-plugs', name: 'Zündkerzen wechseln', category: 'Motor', laborHours: 1.0, partsMin: 25, partsMax: 70, requires: (t) => t.hasSparkPlugs },
  { id: 'air-filter', name: 'Luftfilter wechseln', category: 'Motor', laborHours: 0.4, partsMin: 15, partsMax: 45, requires: (t) => t.hasCombustionEngine },
  { id: 'glow-plugs', name: 'Glühkerzen wechseln', category: 'Motor', laborHours: 1.6, partsMin: 40, partsMax: 100, requires: (t) => t.hasDiesel, note: 'Festsitzende Kerzen können den Aufwand deutlich erhöhen.' },
  { id: 'timing-belt', name: 'Zahnriemen inkl. Wasserpumpe', category: 'Motor', laborHours: 5.5, partsMin: 150, partsMax: 380, requires: (t) => t.hasTimingBelt, note: 'Nur nötig, wenn der Motor einen Zahnriemen hat – bei Steuerkette entfällt die Position.' },
  { id: 'clutch', name: 'Kupplung erneuern', category: 'Antrieb', laborHours: 7.0, partsMin: 260, partsMax: 640, requires: (t) => t.hasManualClutch },
  { id: 'chain-kit', name: 'Kettenkit erneuern', category: 'Antrieb', laborHours: 1.5, partsMin: 110, partsMax: 260, requires: (t) => t.hasChainDrive },
  { id: 'valve-clearance', name: 'Ventilspiel prüfen und einstellen', category: 'Motor', laborHours: 3.0, partsMin: 20, partsMax: 90, requires: (t) => t.hasChainDrive },
  { id: 'egr', name: 'AGR-Ventil ersetzen', category: 'Abgas', laborHours: 2.2, partsMin: 115, partsMax: 320, requires: (t) => t.hasDiesel },
  { id: 'dpf-clean', name: 'Partikelfilter reinigen', category: 'Abgas', laborHours: 2.0, partsMin: 70, partsMax: 190, requires: (t) => t.hasParticulateFilter },
  { id: 'lambda', name: 'Lambdasonde tauschen', category: 'Abgas', laborHours: 0.9, partsMin: 52, partsMax: 145, requires: (t) => t.hasCatalyst },
  { id: 'shocks-rear', name: 'Stoßdämpfer hinten (Paar)', category: 'Fahrwerk', laborHours: 1.6, partsMin: 99, partsMax: 330 },
  { id: 'wheel-alignment', name: 'Achsvermessung + Einstellung', category: 'Fahrwerk', laborHours: 1.5, partsMin: 0, partsMax: 0, requires: (t) => t.wheelCount > 2 },
  { id: 'wheel-swap', name: 'Räder umstecken (Saisonwechsel)', category: 'Fahrwerk', laborHours: 0.6, partsMin: 0, partsMax: 0, requires: (t) => t.wheelCount > 2 },
  { id: 'ac-service', name: 'Klimaservice inkl. Befüllung', category: 'Komfort', laborHours: 1.0, partsMin: 45, partsMax: 110, requires: (t) => t.hasAirConditioning },
  { id: 'cabin-filter', name: 'Innenraumfilter wechseln', category: 'Komfort', laborHours: 0.5, partsMin: 12, partsMax: 40, requires: (t) => t.hasAirConditioning },
  { id: 'coolant-flush', name: 'Kühlmittel wechseln', category: 'Motor', laborHours: 1.2, partsMin: 20, partsMax: 45, requires: (t) => t.hasCoolant },
  { id: 'hv-battery-check', name: 'Hochvoltbatterie prüfen', category: 'Elektrik', laborHours: 1.0, partsMin: 0, partsMax: 0, requires: (t) => t.hasHighVoltageBattery, note: 'Das Prüfprotokoll dokumentiert die Restkapazität – wichtig beim Verkauf.' },
  { id: 'turbo', name: 'Turbolader erneuern', category: 'Motor', laborHours: 6.0, partsMin: 620, partsMax: 1700, requires: (t) => t.hasCombustionEngine },
]

/** Reparaturpositionen für ein konkretes Fahrzeug, mit skalierten Teilen und Arbeitszeiten */
export function repairJobsFor(vehicle: Vehicle): RepairJob[] {
  const traits = vehicleTraits(vehicle)
  const { partsFactor, laborFactor } = vehicleProfile(vehicle)

  return JOB_TEMPLATES.filter((j) => !j.requires || j.requires(traits)).map((j) => ({
    id: j.id,
    name: j.name,
    category: j.category,
    laborHours: Math.round(j.laborHours * laborFactor * 10) / 10,
    partsMinEur: roundPrice(j.partsMin * partsFactor),
    partsMaxEur: roundPrice(j.partsMax * partsFactor),
    note: j.note,
  }))
}

export const HOURLY_RATES = [
  { label: 'Freie Werkstatt', rate: 110 },
  { label: 'Meisterbetrieb', rate: 140 },
  { label: 'Vertragswerkstatt', rate: 175 },
] as const
