import type Anthropic from '@anthropic-ai/sdk'
import type { InvoiceExplanation, InvoicePosition, MaintenanceKind, RepairJob, Vehicle } from '../types'
import { askAiStructured, userMessage } from './ai/client'
import { SYSTEM_INVOICE_EXPLAIN, vehicleContext } from './ai/prompts'

/**
 * Die Werkstattrechnung verständlich machen.
 *
 * Der Beleg ist der Moment, in dem ein Laie am meisten zahlt und am wenigsten
 * versteht: „Querlenker vorne links ersetzt, 289,90 €". Die App liest ihn aus
 * und übersetzt jede Zeile – was ist das, warum macht man das, welches Teil am
 * Fahrzeug ist gemeint.
 *
 * Zwei Dinge macht bewusst **nicht** die KI:
 * - Die Zuordnung zum Bauteil im Modell. Die KI liefert nur den Begriff
 *   ("Bremsscheibe"), die Stelle findet `findHotspotId()` aus den Daten.
 * - Die Bewertung des Preises. Die rechnet `invoiceCheck.ts` mit dem
 *   Stundensatz des Nutzers. Eine geratene Zahl neben einer echten Rechnung
 *   wäre ein Vorwurf gegen die Werkstatt ohne Grundlage.
 */

const KINDS = ['Wartung', 'Verschleiß', 'Reparatur', 'Material', 'Arbeitslohn', 'Sonstiges']
const NECESSITY = ['nötig', 'vorbeugend', 'Komfort', 'unklar']

const MAINTENANCE_KINDS: MaintenanceKind[] = [
  'oil',
  'inspection',
  'brake-fluid',
  'air-filter',
  'cabin-filter',
  'spark-plugs',
  'timing-belt',
  'ac-service',
  'tires',
  'battery',
  'hu',
  'chain',
  'valve-clearance',
  'coolant',
  'dpf',
  'hv-battery',
]

/**
 * Das Schema entsteht je Fahrzeug neu: Die erlaubten Werkstattpositionen sind
 * die, die es an diesem Fahrzeug überhaupt gibt. So kann die KI einer Rechnung
 * für ein E-Auto keinen Ölservice zuordnen.
 */
function schemaFor(jobs: RepairJob[]) {
  return {
    type: 'object',
    properties: {
      readable: {
        type: 'boolean',
        description: 'Ist auf dem Bild ein lesbarer Beleg zu erkennen? Bei false erklärt "note" warum nicht.',
      },
      workshop: { type: 'string', description: 'Name der Werkstatt laut Beleg' },
      date: { type: 'string', description: 'Rechnungsdatum im Format JJJJ-MM-TT' },
      totalGrossEur: { type: 'number', description: 'Endsumme brutto in Euro, nur wenn eindeutig lesbar' },
      mileage: { type: 'number', description: 'Kilometerstand laut Beleg, nur die Zahl' },
      summary: { type: 'string', description: 'Was insgesamt gemacht wurde, 2–4 Sätze in Alltagssprache' },
      positions: {
        type: 'array',
        description: 'Die Zeilen des Belegs, in der Reihenfolge der Rechnung',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Wortlaut wie auf der Rechnung' },
            plain: { type: 'string', description: 'Dieselbe Sache in Alltagssprache, 1–2 Sätze' },
            why: { type: 'string', description: 'Warum man das macht, 1–2 Sätze' },
            partHint: {
              type: 'string',
              description:
                'Übliches deutsches Wort für das betroffene Bauteil, Einzahl, ohne Zusätze. Bei reiner Arbeit oder Gebühren weglassen.',
            },
            jobId: {
              type: 'string',
              enum: jobs.map((j) => j.id),
              description:
                'Vergleichbare Werkstattposition – nur bei eindeutiger Entsprechung setzen, sonst weglassen: ' +
                jobs.map((j) => `${j.id} = ${j.name}`).join(', '),
            },
            priceEur: { type: 'number', description: 'Betrag dieser Zeile in Euro, nur wenn lesbar' },
            kind: { type: 'string', enum: KINDS, description: 'Art der Position' },
            necessity: { type: 'string', enum: NECESSITY, description: 'Wie zwingend die Arbeit war' },
          },
          required: ['label', 'plain', 'kind'],
        },
      },
      questions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Konkrete, höfliche Fragen an die Werkstatt – nur wo es etwas zu fragen gibt',
      },
      followUp: {
        type: 'array',
        items: { type: 'string' },
        description: 'Was daraus für die nächsten Monate folgt',
      },
      maintenanceKinds: {
        type: 'array',
        items: { type: 'string', enum: MAINTENANCE_KINDS },
        description:
          'Wartungsarten, die dieser Beleg eindeutig erledigt hat. oil = Ölwechsel, ' +
          'inspection = Inspektion, brake-fluid = Bremsflüssigkeit, air-filter = Luftfilter, ' +
          'cabin-filter = Innenraumfilter, spark-plugs = Zünd-/Glühkerzen, timing-belt = Zahnriemen, ' +
          'ac-service = Klimaservice, tires = Reifen, battery = Starterbatterie, hu = Hauptuntersuchung, ' +
          'chain = Antriebskette, valve-clearance = Ventilspiel, coolant = Kühlmittel, ' +
          'dpf = Partikelfilter, hv-battery = Hochvoltbatterie. Im Zweifel weglassen.',
      },
      note: { type: 'string', description: 'Was unklar oder nicht lesbar war' },
    },
    required: ['readable', 'summary', 'positions'],
  } as unknown as Anthropic.Tool.InputSchema
}

export async function explainInvoice(
  imageDataUrl: string,
  vehicle: Vehicle,
  jobs: RepairJob[],
  signal?: AbortSignal,
): Promise<InvoiceExplanation> {
  const answer = await askAiStructured<InvoiceExplanation>({
    system: SYSTEM_INVOICE_EXPLAIN,
    context: vehicleContext(vehicle),
    messages: [
      userMessage(
        'Das ist die Rechnung meiner Werkstatt. Erkläre mir Zeile für Zeile, was gemacht wurde und warum – ich bin kein Fachmann.',
        imageDataUrl,
      ),
    ],
    toolName: 'rechnung_erklaeren',
    toolDescription: 'Liest eine Werkstattrechnung aus und erklärt jede Position für Laien',
    schema: schemaFor(jobs),
    maxTokens: 4096,
    signal,
  })

  return sanitizeInvoice(answer, jobs.map((j) => j.id))
}

/**
 * Was die KI liefert, muss die Anzeige aushalten: leere Zeilen, unmögliche
 * Beträge und erfundene Positions-Ids fliegen hier raus. Eine falsche `jobId`
 * wäre besonders teuer – daran hängt der Preisvergleich.
 */
export function sanitizeInvoice(answer: InvoiceExplanation, knownJobIds: string[]): InvoiceExplanation {
  const jobs = new Set(knownJobIds)
  const positions: InvoicePosition[] = (answer.positions ?? [])
    .map((p) => {
      const price = Number(p?.priceEur)
      return {
        ...p,
        label: (p?.label ?? '').trim(),
        plain: (p?.plain ?? '').trim(),
        why: p?.why?.trim() || undefined,
        partHint: p?.partHint?.trim() || undefined,
        jobId: p?.jobId && jobs.has(p.jobId) ? p.jobId : undefined,
        // Über 50.000 € ist keine Rechnungszeile mehr, sondern ein Lesefehler
        priceEur: Number.isFinite(price) && price > 0 && price < 50_000 ? Math.round(price * 100) / 100 : undefined,
        kind: (KINDS.includes(p?.kind) ? p.kind : 'Sonstiges') as InvoicePosition['kind'],
        necessity: (NECESSITY.includes(p?.necessity ?? '')
          ? p.necessity
          : undefined) as InvoicePosition['necessity'],
      }
    })
    .filter((p) => p.label && p.plain)

  const total = Number(answer.totalGrossEur)
  const mileage = Number(answer.mileage)
  return {
    ...answer,
    readable: answer.readable !== false && positions.length > 0,
    summary: (answer.summary ?? '').trim(),
    positions,
    questions: (answer.questions ?? []).map((q) => q.trim()).filter(Boolean),
    followUp: (answer.followUp ?? []).map((f) => f.trim()).filter(Boolean),
    maintenanceKinds: (answer.maintenanceKinds ?? []).filter((k) => MAINTENANCE_KINDS.includes(k)),
    totalGrossEur:
      Number.isFinite(total) && total > 0 && total < 200_000 ? Math.round(total * 100) / 100 : undefined,
    mileage: Number.isFinite(mileage) && mileage > 0 && mileage < 3_000_000 ? Math.round(mileage) : undefined,
  }
}
