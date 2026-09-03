import type Anthropic from '@anthropic-ai/sdk'
import type { Guide, GuideAdaptation, Vehicle } from '../types'
import { askAiStructured } from './ai/client'
import { SYSTEM_GUIDE_ADAPT, vehicleContext } from './ai/prompts'

/**
 * „Was ist bei meinem Fahrzeug anders?" – strukturiert statt im Fließtext.
 *
 * Die elf Anleitungen sind bewusst fahrzeugübergreifend formuliert. Was an
 * einem konkreten Auto abweicht, weiß nur die KI. Als Prosa war das nicht
 * verwertbar: Der Hinweis zu Schritt 4 stand irgendwo in einem Absatz, während
 * der Nutzer mit öligen Händen bei Schritt 4 stand. Deshalb kommt die Antwort
 * mit dem Bezug zum Schritt zurück – die App legt sie dorthin, wo sie hingehört.
 *
 * Muster wie `partExplain.ts`: eigenes Schema, Sitzungs-Zwischenspeicher,
 * `askAiStructured()`. Zahlen bleiben draußen, Drehmomente und Füllmengen
 * stehen im Herstellerhandbuch.
 */

const SCHEMA = {
  type: 'object',
  properties: {
    fits: {
      type: 'boolean',
      description: 'Läuft diese Arbeit an genau diesem Fahrzeug so ab? Bei false erklärt "note" warum nicht.',
    },
    summary: { type: 'string', description: 'Worauf es bei diesem Fahrzeug ankommt, 2–4 Sätze' },
    stepNotes: {
      type: 'array',
      description: 'Hinweise zu einzelnen Schritten – nur wo es wirklich etwas zu sagen gibt',
      items: {
        type: 'object',
        properties: {
          step: { type: 'number', description: 'Nummer des Schritts aus der Anleitung, 1-basiert' },
          note: { type: 'string', description: 'Was bei diesem Schritt an diesem Fahrzeug abweicht' },
        },
        required: ['step', 'note'],
      },
    },
    specialTools: {
      type: 'array',
      items: { type: 'string' },
      description: 'Spezialwerkzeug über die Werkzeugliste der Anleitung hinaus',
    },
    timeNoviceMin: {
      type: 'number',
      description: 'Realistische Dauer in Minuten für jemanden, der das zum ersten Mal macht',
    },
    pitfalls: {
      type: 'array',
      items: { type: 'string' },
      description: 'Typische Stolperfallen bei diesem Fahrzeug',
    },
    recommendWorkshop: {
      type: 'boolean',
      description: 'Rätst Du bei diesem Fahrzeug von der Eigenarbeit ab?',
    },
    workshopReason: { type: 'string', description: 'Begründung, falls recommendWorkshop true ist' },
    note: { type: 'string', description: 'Annahme oder Einschränkung, falls nötig' },
  },
  required: ['fits', 'summary'],
} as unknown as Anthropic.Tool.InputSchema

/** Antworten der Sitzung merken – zweimal dieselbe Anleitung kostet sonst zweimal Kontingent */
const cache = new Map<string, GuideAdaptation>()

const cacheKey = (guide: Guide, vehicle: Vehicle) => `${vehicle.id}|${guide.id}`

export function cachedAdaptation(guide: Guide, vehicle: Vehicle): GuideAdaptation | undefined {
  return cache.get(cacheKey(guide, vehicle))
}

export async function adaptGuide(
  guide: Guide,
  vehicle: Vehicle,
  signal?: AbortSignal,
): Promise<GuideAdaptation> {
  const known = cachedAdaptation(guide, vehicle)
  if (known) return known

  const stepList = guide.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`).join('\n')
  const answer = await askAiStructured<GuideAdaptation>({
    system: SYSTEM_GUIDE_ADAPT,
    context: vehicleContext(vehicle),
    messages: [
      {
        role: 'user',
        content: [
          `Ich möchte "${guide.title}" an meinem Fahrzeug selbst machen.`,
          `Die Anleitung der App nennt ${guide.durationMin} Minuten und diese Schritte:`,
          stepList,
          `Werkzeug laut Anleitung: ${guide.tools.join(', ') || 'keines'}.`,
          guide.parts.length ? `Material laut Anleitung: ${guide.parts.join(', ')}.` : '',
          'Was ist bei genau diesem Fahrzeug anders?',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    toolName: 'anleitung_anpassen',
    toolDescription: 'Überträgt eine allgemeine Reparaturanleitung auf ein konkretes Fahrzeug',
    schema: SCHEMA,
    signal,
  })

  const cleaned = sanitizeAdaptation(answer, guide.steps.length)
  if (cache.size > 20) cache.delete(cache.keys().next().value as string)
  cache.set(cacheKey(guide, vehicle), cleaned)
  return cleaned
}

/**
 * Eine Schrittnummer außerhalb der Anleitung wäre ein Hinweis, der nirgends
 * auftaucht – deshalb wird sie hier verworfen statt still verschluckt.
 * Ebenso doppelte Nummern: Der Platz neben dem Schritt trägt einen Hinweis.
 */
export function sanitizeAdaptation(answer: GuideAdaptation, stepCount: number): GuideAdaptation {
  const seen = new Set<number>()
  const stepNotes = (answer.stepNotes ?? [])
    .map((n) => ({ step: Math.round(Number(n?.step)), note: (n?.note ?? '').trim() }))
    .filter((n) => n.note && Number.isFinite(n.step) && n.step >= 1 && n.step <= stepCount)
    .filter((n) => (seen.has(n.step) ? false : (seen.add(n.step), true)))
    .sort((a, b) => a.step - b.step)

  const minutes = Number(answer.timeNoviceMin)
  return {
    ...answer,
    fits: answer.fits !== false,
    summary: (answer.summary ?? '').trim(),
    stepNotes,
    specialTools: (answer.specialTools ?? []).map((t) => t.trim()).filter(Boolean),
    pitfalls: (answer.pitfalls ?? []).map((p) => p.trim()).filter(Boolean),
    // Über einen Arbeitstag hinaus ist die Zahl ein Missverständnis, keine Schätzung
    timeNoviceMin: Number.isFinite(minutes) && minutes > 0 && minutes <= 600 ? Math.round(minutes) : undefined,
  }
}
