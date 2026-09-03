import type {
  ActivityEntry,
  DiagnosisEntry,
  MaintenanceItem,
  MaintenanceKind,
  RepairJob,
  Vehicle,
  VehicleDocument,
  VehicleKind,
} from '../types'
import { maintenanceStatus, sortByUrgency } from './maintenance'
import { valuate, type Valuation } from './valuation'

/**
 * Verkaufen: Untergrenze und der wirkliche Zustand.
 *
 * `valuate()` kennt das Fahrzeug nur auf dem Papier – Baujahr, Kilometer,
 * Zustandsnote, Antrieb. Beim Verkauf entscheidet aber, was der Käufer
 * nachholen muss: abgelaufene HU, offene Fehlercodes, überfällige Wartung.
 * Und umgekehrt zahlt er mehr, wenn der Service belegt ist.
 *
 * Deshalb greift alles hier **nach** der Bewertung und lässt sie unangetastet:
 * `calculateCosts()` und `compareVehicles()` hängen an ihren Feldern.
 *
 * Zwei Regeln, die diese Datei tragen:
 * - **Nichts pauschal.** Jeder Abschlag hat einen Betrag *und* eine Rechnung.
 *   Wo die Rechnung fehlt (keine passende Werkstattposition, kein Stundensatz),
 *   entsteht kein Posten – eine geratene Zahl wäre schlimmer als keine.
 * - **Ohne Kontext bleibt alles wie heute.** Der Nachschlagen-Screen bewertet
 *   ein Fahrzeug, das gar nicht angelegt ist: kein Wartungsplan, keine
 *   Fehlercodes. Dann kommt eine leere Liste zurück.
 *
 * Ohne Netz und ohne KI prüfbar: `npm run test:value`.
 */

export interface SellingContext {
  /** Wartungsplan des Fahrzeugs – aus `useVehicleMaintenance()` */
  maintenance?: MaintenanceItem[]
  activities?: ActivityEntry[]
  diagnoses?: DiagnosisEntry[]
  documents?: VehicleDocument[]
  /** Werkstattpositionen dieses Fahrzeugs – aus `repairJobsFor()`, schon umgerechnet */
  jobs?: RepairJob[]
  /** Stundensatz aus den Einstellungen; ohne ihn gibt es keine Nachholkosten */
  hourlyRateEur?: number
  /** Bereits gerechnete Bewertung – spart den zweiten Durchlauf */
  valuation?: Valuation
  at?: Date
}

export interface ValueAdjustment {
  id: string
  label: string
  /** Warum das den Preis bewegt – ein Satz für den Käufer */
  reason: string
  /** Negativ = Abschlag, positiv = Aufschlag */
  amountEur: number
  /** Offengelegte Rechnung für die Anzeige */
  formula: string
}

export interface SellingFloor {
  /** Privatwert aus `valuate()`, unverändert */
  basePrivate: number
  adjustments: ValueAdjustment[]
  adjustmentsTotal: number
  /** Privatwert nach Zu- und Abschlägen */
  adjustedPrivate: number
  /** Die Untergrenze: was ein Händler sofort und ohne Aufwand zahlt */
  floor: number
  /** Startpreis fürs Inserat – mit Luft zum Verhandeln */
  askingPrice: number
  /** Wurde die Summe der Abschläge begrenzt? Dann steht das auch im UI */
  capped: boolean
  /** Der Satz, den man in der Verhandlung sagen kann */
  sentence: string
  formula: string
}

/** Was den Preis belegt, was ihn drückt und was noch fehlt */
export type SellingPointKind = 'proof' | 'drag' | 'missing'

export interface SellingPoint {
  id: string
  kind: SellingPointKind
  title: string
  detail: string
}

const euro = (value: number) => `${Math.round(value).toLocaleString('de-DE')} €`
const round50 = (value: number) => Math.round(value / 50) * 50

/**
 * Übliche Gebühr für Hauptuntersuchung samt Abgasuntersuchung, nach Fahrzeugart.
 * Keine Modellpreise – ein Prüfstand nimmt für jeden Pkw dasselbe.
 */
const HU_FEE: Record<VehicleKind, number> = {
  car: 145,
  motorcycle: 75,
  van: 165,
  truck: 320,
  bus: 320,
  camper: 190,
}

/**
 * Abschlag je offenem Fehlercode als Anteil des Werts.
 *
 * Warum ein Anteil und keine Reparaturkostenschätzung: Zu einem Fehlercode
 * gehört keine feste Arbeit – P0420 kann eine Lambdasonde sein oder ein
 * Katalysator. Der Käufer zieht deshalb kein konkretes Angebot ab, sondern
 * das Risiko. Die Sätze stehen offen im UI.
 */
const DTC_SHARE = { critical: 0.06, warn: 0.03, info: 0.01 } as const

const DTC_LABEL = {
  critical: 'schwerwiegend',
  warn: 'zu beobachten',
  info: 'Hinweis',
} as const

/** Wie viel ein belegter Service vom bezahlten Betrag am Markt zurückbringt */
const RECEIPT_RECOVERY = 0.2
/** Deckel für den Aufschlag aus Belegen */
const RECEIPT_CAP_SHARE = 0.04
/** Nur Dokumente ohne Beträge – dann ein kleiner, gedeckelter Aufschlag */
const DOCUMENT_ONLY_SHARE = 0.02
/** Anteil des Werts, den eine abgelaufene HU zusätzlich zur Gebühr kostet */
const HU_RISK_SHARE = 0.02
/** Unter diesen Anteil des Privatwerts drücken die Abschläge nicht */
const FLOOR_SHARE = 0.45
/** Mehr als das kann kein Zustand aufschlagen */
const BONUS_CAP_SHARE = 0.08

/**
 * Wartungsart → passende Werkstattposition.
 *
 * Mehrere Kandidaten, weil `repairJobsFor()` schon fahrzeuggerecht gefiltert
 * hat: Bei einem Diesel fällt „Zündkerzen" weg und „Glühkerzen" bleibt übrig,
 * bei einem Benziner umgekehrt. Was keine Position hat (Reifen prüfen), bekommt
 * bewusst keinen Betrag.
 */
const JOB_FOR_KIND: Partial<Record<MaintenanceKind, string[]>> = {
  oil: ['oil-service'],
  inspection: ['inspection'],
  'brake-fluid': ['brake-fluid'],
  'air-filter': ['air-filter'],
  'cabin-filter': ['cabin-filter'],
  'spark-plugs': ['spark-plugs', 'glow-plugs'],
  'timing-belt': ['timing-belt'],
  'ac-service': ['ac-service'],
  battery: ['battery'],
  chain: ['chain-kit'],
  'valve-clearance': ['valve-clearance'],
  coolant: ['coolant-flush'],
  dpf: ['dpf-clean'],
  'hv-battery': ['hv-battery-check'],
}

function jobFor(kind: MaintenanceKind, jobs: RepairJob[]): RepairJob | undefined {
  for (const id of JOB_FOR_KIND[kind] ?? []) {
    const hit = jobs.find((j) => j.id === id)
    if (hit) return hit
  }
  return undefined
}

/** „Seit 1 Monat" statt „Seit 1 Monaten" – bei einem Betrag daneben fällt so etwas auf */
function overdueSince(days: number): string {
  const months = Math.abs(Math.round(days / 30.44))
  if (months <= 1) return 'Seit einem Monat'
  return `Seit ${months} Monaten`
}

function daysUntil(iso: string, at: Date): number | null {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return null
  return Math.round((due.getTime() - at.getTime()) / 86_400_000)
}

function monthsAgo(iso: string, at: Date): number | null {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return (at.getTime() - then.getTime()) / (86_400_000 * 30.44)
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * Die Auf- und Abschläge, die der Papierwert nicht kennt.
 *
 * Reihenfolge der Anzeige: erst was drückt, dann was hebt – so liest sich die
 * Liste wie die Verhandlung selbst.
 */
export function valueAdjustments(vehicle: Vehicle, context: SellingContext = {}): ValueAdjustment[] {
  const at = context.at ?? new Date()
  const valuation = context.valuation ?? valuate(vehicle, at)
  const base = valuation.privateSale
  if (!(base > 0)) return []

  const out: ValueAdjustment[] = []
  const jobs = context.jobs ?? []
  const rate = positive(context.hourlyRateEur)

  // --- Überfällige Wartung: der Käufer muss sie sofort nachholen ---
  const overdue = sortByUrgency(
    (context.maintenance ?? []).map((item) => maintenanceStatus(item, vehicle)),
  ).filter((s) => s.state === 'overdue')

  for (const status of overdue) {
    // Die HU steckt im Termin am Fahrzeug – sonst zählt sie doppelt
    if (status.item.kind === 'hu') continue
    const job = jobFor(status.item.kind, jobs)
    if (!job || !rate) continue

    const labor = Math.round(job.laborHours * rate)
    const cost = Math.round(job.partsMinEur) + labor
    if (cost <= 0) continue

    out.push({
      id: `maintenance-${status.item.id}`,
      label: `${status.item.label} überfällig`,
      reason: `${status.dueLabel} – das lässt sich der Käufer vom Preis abziehen.`,
      amountEur: -cost,
      formula:
        `Teile ab ${euro(job.partsMinEur)}  +  ${job.laborHours.toLocaleString('de-DE')} h × ` +
        `${euro(rate)}/h = ${euro(cost)}`,
    })
  }

  // --- Offene Fehlercodes: kein Käufer zahlt den vollen Preis für ein Rätsel ---
  for (const dtc of (context.diagnoses ?? []).filter((d) => !d.resolved)) {
    const severity = (dtc.severity ?? 'info') as keyof typeof DTC_SHARE
    const share = DTC_SHARE[severity] ?? DTC_SHARE.info
    const amount = Math.round(base * share)
    if (amount <= 0) continue

    out.push({
      id: `dtc-${dtc.id}`,
      label: `Fehlercode ${dtc.code} offen`,
      reason: `${dtc.title} – solange der Speicher nicht leer ist, rechnet der Käufer mit einer Reparatur.`,
      amountEur: -amount,
      formula: `${(share * 100).toLocaleString('de-DE')} % von ${euro(base)} (${DTC_LABEL[severity]}) = ${euro(amount)}`,
    })
  }

  // --- Hauptuntersuchung ---
  const fee = HU_FEE[vehicle.kind] ?? HU_FEE.car
  const huDays = vehicle.huDue ? daysUntil(vehicle.huDue, at) : null
  if (huDays != null) {
    if (huDays < 0) {
      const risk = Math.round(base * HU_RISK_SHARE)
      const amount = fee + risk
      out.push({
        id: 'hu-expired',
        label: 'HU abgelaufen',
        reason: `${overdueSince(huDays)} fällig. Ohne Plakette darf der Käufer nicht losfahren – und weiß nicht, was für sie noch nötig wird.`,
        amountEur: -amount,
        formula: `HU + AU ${euro(fee)}  +  ${(HU_RISK_SHARE * 100).toLocaleString('de-DE')} % Risiko (${euro(risk)}) = ${euro(amount)}`,
      })
    } else if (huDays < 90) {
      out.push({
        id: 'hu-soon',
        label: 'HU läuft bald ab',
        reason: `In ${huDays} Tagen fällig – der Käufer zahlt sie direkt nach dem Kauf.`,
        amountEur: -fee,
        formula: `HU + AU ${euro(fee)}`,
      })
    } else if (huDays > 600) {
      out.push({
        id: 'hu-fresh',
        label: 'HU frisch gemacht',
        reason: `Noch ${Math.round(huDays / 30.44)} Monate gültig – das spart dem Käufer den Prüfstand.`,
        amountEur: fee,
        formula: `HU + AU ${euro(fee)}, die der Käufer nicht zahlen muss`,
      })
    }
  }

  // --- Belegte Wartung: Rechnungen sind das einzige, was Pflege beweist ---
  const spent = (context.activities ?? [])
    .filter((a) => {
      const age = monthsAgo(a.date, at)
      return age != null && age >= 0 && age <= 24 && positive(a.costEur)
    })
    .reduce((sum, a) => sum + (a.costEur ?? 0), 0)

  const receiptCount = (context.activities ?? []).filter((a) => {
    const age = monthsAgo(a.date, at)
    return age != null && age >= 0 && age <= 24 && positive(a.costEur)
  }).length

  const proofDocs = (context.documents ?? []).filter(
    (d) => d.category === 'Rechnung' || d.category === 'Serviceheft',
  ).length

  if (receiptCount >= 2 && spent > 0) {
    const amount = Math.round(Math.min(spent * RECEIPT_RECOVERY, base * RECEIPT_CAP_SHARE))
    if (amount > 0) {
      out.push({
        id: 'receipts',
        label: 'Wartung ist belegt',
        reason: `${receiptCount} Belege der letzten zwei Jahre über zusammen ${euro(spent)}. Ein nachweisbar gepflegtes Fahrzeug verkauft sich über dem Durchschnitt.`,
        amountEur: amount,
        formula:
          `${(RECEIPT_RECOVERY * 100).toLocaleString('de-DE')} % von ${euro(spent)}, gedeckelt bei ` +
          `${(RECEIPT_CAP_SHARE * 100).toLocaleString('de-DE')} % des Werts = ${euro(amount)}`,
      })
    }
  } else if (proofDocs >= 2) {
    const amount = Math.round(base * DOCUMENT_ONLY_SHARE)
    if (amount > 0) {
      out.push({
        id: 'documents',
        label: 'Serviceunterlagen vorhanden',
        reason: `${proofDocs} Rechnungen bzw. Serviceheft-Einträge liegen in der App. Beträge stehen keine dabei – gezeigt werden können sie trotzdem.`,
        amountEur: amount,
        formula: `${(DOCUMENT_ONLY_SHARE * 100).toLocaleString('de-DE')} % von ${euro(base)} = ${euro(amount)}`,
      })
    }
  }

  return out.sort((a, b) => a.amountEur - b.amountEur)
}

/**
 * Die Preisuntergrenze.
 *
 * Der Händler-Ankauf ist die belastbare Untergrenze: Diesen Preis bekommt man
 * heute, ohne Inserat, ohne Besichtigungen, ohne Gewährleistungsstreit. Wer
 * privat darunter verkauft, verschenkt Geld – dafür hätte er den Aufwand nicht
 * gebraucht.
 *
 * Die Verhältnisse (Händler-Ankauf, Verhandlungsluft) kommen aus der Bewertung
 * selbst und nicht als zweite Konstante, damit sie nicht auseinanderlaufen.
 */
export function sellingFloor(vehicle: Vehicle, context: SellingContext = {}): SellingFloor {
  const at = context.at ?? new Date()
  const valuation = context.valuation ?? valuate(vehicle, at)
  const base = valuation.privateSale
  const adjustments = valueAdjustments(vehicle, { ...context, valuation, at })
  const total = adjustments.reduce((sum, a) => sum + a.amountEur, 0)

  const lowerLimit = base * FLOOR_SHARE
  const upperLimit = base * (1 + BONUS_CAP_SHARE)
  const uncapped = base + total
  const capped = uncapped < lowerLimit || uncapped > upperLimit
  const adjustedPrivate = round50(Math.min(Math.max(uncapped, lowerLimit), upperLimit))

  // Verhältnisse aus der Bewertung übernehmen statt neu zu setzen
  const dealerRatio = base > 0 ? valuation.dealerPurchase / base : 0.86
  const askRatio = base > 0 ? valuation.rangeMax / base : 1.07

  const floor = round50(adjustedPrivate * dealerRatio)
  const askingPrice = round50(adjustedPrivate * askRatio)

  const sign = total < 0 ? '−' : '+'
  const formula =
    `Privatwert ${euro(base)}  ${sign} ${euro(Math.abs(total))} Zu-/Abschläge = ${euro(adjustedPrivate)}` +
    `  →  Händler-Ankauf ${Math.round(dealerRatio * 100)} % = ${euro(floor)}`

  const sentence =
    total < 0
      ? `Unter ${euro(floor)} gebe ich das Fahrzeug nicht her: So viel zahlt mir ein Händler sofort – und der übernimmt den ganzen Aufwand.`
      : `Unter ${euro(floor)} gebe ich das Fahrzeug nicht her: So viel zahlt mir ein Händler sofort, ohne Inserat und ohne Besichtigungen.`

  return {
    basePrivate: base,
    adjustments,
    adjustmentsTotal: total,
    adjustedPrivate,
    floor,
    askingPrice,
    capped,
    sentence,
    formula,
  }
}

/**
 * Der Verkaufs-Check: was den Preis belegt, was ihn drückt, was noch fehlt.
 *
 * Alles daraus liegt bereits in der App – der Screen soll es nur an einer
 * Stelle zeigen, statt den Nutzer durch vier Bereiche zu schicken.
 */
export function sellingChecklist(vehicle: Vehicle, context: SellingContext = {}): SellingPoint[] {
  const at = context.at ?? new Date()
  const out: SellingPoint[] = []

  const activities = context.activities ?? []
  const documents = context.documents ?? []
  const diagnoses = context.diagnoses ?? []
  const statuses = (context.maintenance ?? []).map((item) => maintenanceStatus(item, vehicle))

  // --- Was den Preis belegt ---
  const receipts = activities.filter((a) => {
    const age = monthsAgo(a.date, at)
    return age != null && age >= 0 && age <= 24 && positive(a.costEur)
  })
  if (receipts.length) {
    const spent = receipts.reduce((sum, a) => sum + (a.costEur ?? 0), 0)
    out.push({
      id: 'proof-receipts',
      kind: 'proof',
      title: `${receipts.length} Belege über ${euro(spent)}`,
      detail: 'Zeig sie beim Termin. Nichts überzeugt so schnell wie eine Rechnung mit Datum und Kilometerstand.',
    })
  }

  const fresh = statuses.filter((s) => s.state === 'ok' && s.progress < 0.35)
  if (fresh.length) {
    out.push({
      id: 'proof-fresh',
      kind: 'proof',
      title: `Frisch erledigt: ${fresh.slice(0, 3).map((s) => s.item.label).join(', ')}`,
      detail: 'Das muss der Käufer in den nächsten Monaten nicht anfassen – nenne es von Dir aus.',
    })
  }

  const huDays = vehicle.huDue ? daysUntil(vehicle.huDue, at) : null
  if (huDays != null && huDays > 180) {
    out.push({
      id: 'proof-hu',
      kind: 'proof',
      title: `HU noch ${Math.round(huDays / 30.44)} Monate gültig`,
      detail: 'Restlaufzeit der Plakette ist beim Gebrauchtwagen eines der ersten Argumente.',
    })
  }

  const papers = documents.filter((d) => d.category === 'Fahrzeugschein' || d.category === 'Fahrzeugbrief')
  if (papers.length) {
    out.push({
      id: 'proof-papers',
      kind: 'proof',
      title: 'Fahrzeugpapiere sind hinterlegt',
      detail: 'Ohne Brief kein Verkauf. Leg ihn vor dem Termin bereit, nicht währenddessen.',
    })
  }

  // --- Was den Preis drückt ---
  const overdue = sortByUrgency(statuses).filter((s) => s.state === 'overdue' && s.item.kind !== 'hu')
  for (const s of overdue.slice(0, 4)) {
    out.push({
      id: `drag-${s.item.id}`,
      kind: 'drag',
      title: `${s.item.label} überfällig`,
      detail: `${s.dueLabel}. Vor dem Verkauf erledigen bringt meist mehr, als der Käufer abzieht.`,
    })
  }

  const open = diagnoses.filter((d) => !d.resolved)
  if (open.length) {
    out.push({
      id: 'drag-dtc',
      kind: 'drag',
      title: `${open.length} offene${open.length === 1 ? 'r' : ''} Fehlercode${open.length === 1 ? '' : 's'}`,
      detail: `${open.slice(0, 3).map((d) => d.code).join(', ')} – klären oder offen ansprechen. Ein Käufer, der den Speicher selbst ausliest, verhandelt härter.`,
    })
  }

  if (huDays != null && huDays < 90) {
    out.push({
      id: 'drag-hu',
      kind: 'drag',
      title: huDays < 0 ? 'HU ist abgelaufen' : `HU läuft in ${huDays} Tagen ab`,
      detail: 'Mit frischer Plakette verkauft sich das Fahrzeug schneller und teurer als mit dem Abschlag dafür.',
    })
  }

  if (vehicle.condition === 'reparaturbedürftig') {
    out.push({
      id: 'drag-condition',
      kind: 'drag',
      title: 'Zustand: reparaturbedürftig',
      detail: 'Benenne die Mängel im Inserat. Was der Käufer selbst entdeckt, kostet mehr als das, was Du vorher sagst.',
    })
  }

  // --- Was noch fehlt ---
  if (!receipts.length) {
    out.push({
      id: 'missing-receipts',
      kind: 'missing',
      title: 'Keine Belege im Verlauf',
      detail: 'Rechnungen der letzten Jahre unter „Rechnung erklären" einlesen – sie zählen beim Preis.',
    })
  }
  if (!vehicle.huDue) {
    out.push({
      id: 'missing-hu',
      kind: 'missing',
      title: 'HU-Termin nicht eingetragen',
      detail: 'Steht auf der Plakette und im letzten Prüfbericht. Käufer fragen als Erstes danach.',
    })
  }
  if (!papers.length) {
    out.push({
      id: 'missing-papers',
      kind: 'missing',
      title: 'Fahrzeugschein und Brief fehlen in der App',
      detail: 'Als Foto hinterlegt hast Du beim Termin alle Daten parat – Erstzulassung, Schlüsselnummern, Vorbesitzer.',
    })
  }
  if (!positive(vehicle.listPriceNew)) {
    out.push({
      id: 'missing-price',
      kind: 'missing',
      title: 'Neupreis ist geschätzt',
      detail: 'Der echte Listenpreis macht die ganze Rechnung genauer – er steht im Kaufvertrag oder in der Rechnung des Erstkaufs.',
    })
  }

  return out
}
