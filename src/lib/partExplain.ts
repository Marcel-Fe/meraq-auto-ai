import type Anthropic from '@anthropic-ai/sdk'
import type { PartExplanation, Vehicle } from '../types'
import { askAiStructured } from './ai/client'
import { SYSTEM_PART_EXPLAIN, vehicleContext } from './ai/prompts'

/**
 * Freie Bauteil-Suche im Handbuch.
 *
 * Die App kennt gut zwei Dutzend Bauteile fest – ein Fahrzeug hat ein paar
 * tausend. Für alles andere fragt sie die KI mit dem Fahrzeugkontext und bekommt
 * die Antwort strukturiert zurück, damit die App sie wie einen eigenen Eintrag
 * darstellen kann: Funktion, Lage, Symptome, Aufwand und Kostenrahmen.
 *
 * Die Kostenrechnung passiert nicht hier, sondern in `partCost.ts` – die KI
 * liefert nur Ersatzteilpreis und Arbeitszeit, den Stundensatz kennt die App.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Übliche Bezeichnung des gemeinten Bauteils' },
    exists: {
      type: 'boolean',
      description: 'Gibt es dieses Bauteil an genau diesem Fahrzeug? Bei false erklärt "note" warum nicht.',
    },
    fn: { type: 'string', description: 'Wofür das Bauteil da ist, 2–4 Sätze in Alltagssprache' },
    location: { type: 'string', description: 'Wo es an dieser Fahrzeugart sitzt' },
    symptoms: {
      type: 'array',
      items: { type: 'string' },
      description: 'Anzeichen für einen Defekt, das auffälligste zuerst',
    },
    checks: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ungefährliche Schritte, die der Nutzer selbst prüfen kann',
    },
    effort: {
      type: 'string',
      enum: ['selbst machbar', 'mit Erfahrung', 'Werkstatt'],
      description: 'Wie realistisch ein Wechsel in Eigenregie ist',
    },
    interval: { type: 'string', description: 'Übliches Wartungsintervall, falls es eines gibt' },
    partCostMinEur: { type: 'number', description: 'Ersatzteil ab … Euro, nur wenn sicher genug' },
    partCostMaxEur: { type: 'number', description: 'Ersatzteil bis … Euro, nur wenn sicher genug' },
    laborHours: { type: 'number', description: 'Arbeitszeit der Werkstatt in Stunden, ohne Stundensatz' },
    safetyNote: { type: 'string', description: 'Warnung bei Bremsen, Lenkung, Airbag, Reifen, Hochvolt' },
    note: { type: 'string', description: 'Annahme oder Einschränkung, falls nötig' },
  },
  required: ['name', 'exists', 'fn', 'symptoms', 'effort'],
} as unknown as Anthropic.Tool.InputSchema

/** Antworten der Sitzung merken – zweimal dasselbe Teil kostet sonst zweimal Kontingent */
const cache = new Map<string, PartExplanation>()

function cacheKey(query: string, vehicle: Vehicle) {
  return `${vehicle.id}|${query.trim().toLowerCase()}`
}

export function cachedExplanation(query: string, vehicle: Vehicle): PartExplanation | undefined {
  return cache.get(cacheKey(query, vehicle))
}

export async function explainPart(
  query: string,
  vehicle: Vehicle,
  signal?: AbortSignal,
): Promise<PartExplanation> {
  const known = cachedExplanation(query, vehicle)
  if (known) return known

  const answer = await askAiStructured<PartExplanation>({
    system: SYSTEM_PART_EXPLAIN,
    context: vehicleContext(vehicle),
    messages: [{ role: 'user', content: `Erkläre mir dieses Bauteil an meinem Fahrzeug: "${query.trim()}"` }],
    toolName: 'bauteil_erklaeren',
    toolDescription: 'Erklärt ein Bauteil des Fahrzeugs mit Funktion, Symptomen, Aufwand und Kostenrahmen',
    schema: SCHEMA,
    signal,
  })

  const cleaned: PartExplanation = {
    ...answer,
    name: answer.name?.trim() || query.trim(),
    symptoms: (answer.symptoms ?? []).filter(Boolean),
    checks: (answer.checks ?? []).filter(Boolean),
  }
  if (cache.size > 30) cache.delete(cache.keys().next().value as string)
  cache.set(cacheKey(query, vehicle), cleaned)
  return cleaned
}
