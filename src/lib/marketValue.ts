import type Anthropic from '@anthropic-ai/sdk'
import type { MarketOpinion, Vehicle } from '../types'
import { askAiStructured } from './ai/client'
import { SYSTEM_MARKET_VALUE, vehicleContext } from './ai/prompts'
import { formatKm } from './format'

/**
 * Die zweite Meinung zum Marktwert.
 *
 * Die eigene Rechnung bleibt die Hauptzahl – sie ist offengelegt und
 * nachvollziehbar. Was sie nicht kann: einschätzen, wie gefragt genau diese
 * Baureihe ist, welche Ausstattung den Preis hebt und wie lange ein Verkauf
 * dauert. Dafür fragt die App die KI und stellt die Antwort **neben** die
 * eigene Zahl, gekennzeichnet als Einschätzung.
 *
 * Zwei Dinge macht die App bewusst selbst:
 * - Den Vergleich beider Zahlen (`compareToOwn()`). Weichen sie stark ab, wird
 *   der Unterschied benannt statt versteckt – das ist die interessante Stelle.
 * - Die Prüfung auf Unsinn (`sanitizeMarketOpinion()`). Eine Spanne, die um
 *   den Faktor vier neben der Rechnung liegt, ist keine zweite Meinung mehr,
 *   sondern ein Zahlendreher.
 */

const CERTAINTY = ['gut bekannt', 'teilweise bekannt', 'kaum bekannt']
const DEMAND = ['hoch', 'normal', 'gering']

/** Weiter daneben ist kein Standpunkt mehr, sondern ein Fehler */
const PLAUSIBLE_FACTOR = 4

const SCHEMA = {
  type: 'object',
  properties: {
    certainty: {
      type: 'string',
      enum: CERTAINTY,
      description: 'Wie gut Du diese konkrete Baureihe kennst. Ehrlich einschätzen.',
    },
    privateMinEur: {
      type: 'number',
      description:
        'Untere Grenze der realistischen Privatverkaufs-Spanne in Euro. Nur setzen, wenn Du die Baureihe einschätzen kannst.',
    },
    privateMaxEur: { type: 'number', description: 'Obere Grenze derselben Spanne in Euro' },
    priceUp: {
      type: 'array',
      items: { type: 'string' },
      description: 'Was den Preis bei genau diesem Modell hebt, je ein kurzer Satz. Höchstens fünf.',
    },
    priceDown: {
      type: 'array',
      items: { type: 'string' },
      description: 'Was ihn drückt, je ein kurzer Satz. Höchstens fünf.',
    },
    demand: { type: 'string', enum: DEMAND, description: 'Wie gefragt das Fahrzeug gerade ist' },
    demandNote: { type: 'string', description: 'Ein bis zwei Sätze, warum die Nachfrage so ist' },
    timeToSell: {
      type: 'string',
      description: 'Wie lange ein Verkauf üblicherweise dauert, z. B. "zwei bis vier Wochen"',
    },
    bestChannel: {
      type: 'string',
      description: 'Wo sich dieses Fahrzeug am besten verkauft, mit einem Halbsatz Begründung',
    },
    note: { type: 'string', description: 'Annahme oder Einschränkung, falls nötig' },
  },
  required: ['certainty', 'priceUp', 'priceDown', 'demand'],
} as unknown as Anthropic.Tool.InputSchema

/** Antworten der Sitzung merken – dieselbe Frage kostet sonst zweimal Kontingent */
const cache = new Map<string, MarketOpinion>()

function cacheKey(vehicle: Vehicle) {
  return `${vehicle.id}|${vehicle.mileage}|${vehicle.condition}`
}

export function cachedOpinion(vehicle: Vehicle): MarketOpinion | undefined {
  return cache.get(cacheKey(vehicle))
}

export async function askMarketValue(
  vehicle: Vehicle,
  ownPrivateSale: number,
  signal?: AbortSignal,
): Promise<MarketOpinion> {
  const cached = cache.get(cacheKey(vehicle))
  if (cached) return cached

  const answer = await askAiStructured<MarketOpinion>({
    system: SYSTEM_MARKET_VALUE,
    context: vehicleContext(vehicle),
    messages: [
      {
        role: 'user',
        content:
          `Ich will meinen ${vehicle.make} ${vehicle.model} von ${vehicle.year} mit ` +
          `${formatKm(vehicle.mileage)} (${vehicle.powerKw} kW, ${vehicle.fuel}, Zustand ` +
          `${vehicle.condition}) verkaufen. Wie schätzt Du den Markt für diese Baureihe ein – ` +
          `welche Spanne ist privat realistisch, was hebt und was drückt den Preis?`,
      },
    ],
    toolName: 'marktwert_einschaetzen',
    toolDescription: 'Trägt die Markteinschätzung zu dieser Baureihe strukturiert ein.',
    schema: SCHEMA,
    maxTokens: 2000,
    signal,
  })

  const clean = sanitizeMarketOpinion(answer, ownPrivateSale)
  cache.set(cacheKey(vehicle), clean)
  return clean
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function list(values: unknown, max = 5): string[] {
  return (Array.isArray(values) ? values : [])
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .slice(0, max)
}

/**
 * Was die KI liefert, muss neben einer eigenen Rechnung bestehen können.
 *
 * Eine abweichende Spanne bleibt stehen – gerade die ist interessant. Weg
 * fliegt nur, was nicht mehr erklärbar ist: vertauschte Grenzen, Nullwerte und
 * eine Spanne, die um mehr als das Vierfache neben der eigenen Zahl liegt.
 * Dann steht statt einer Zahl der Grund im Hinweis.
 */
export function sanitizeMarketOpinion(answer: MarketOpinion, ownPrivateSale: number): MarketOpinion {
  let min = positive(answer?.privateMinEur)
  let max = positive(answer?.privateMaxEur)
  if (min && max && min > max) [min, max] = [max, min]

  let note = answer?.note?.trim() || undefined
  const own = positive(ownPrivateSale)

  if (min && max && own) {
    const mid = (min + max) / 2
    if (mid > own * PLAUSIBLE_FACTOR || mid < own / PLAUSIBLE_FACTOR) {
      min = undefined
      max = undefined
      note =
        'Die genannte Preisspanne lag um ein Vielfaches neben der eigenen Rechnung und wurde ' +
        'deshalb weggelassen. Die Einschätzung darunter bleibt.'
    }
  }

  // Nur eine der beiden Grenzen ist keine Spanne
  if (!min || !max) {
    min = undefined
    max = undefined
  }

  return {
    certainty: (CERTAINTY.includes(answer?.certainty)
      ? answer.certainty
      : 'teilweise bekannt') as MarketOpinion['certainty'],
    privateMinEur: min,
    privateMaxEur: max,
    priceUp: list(answer?.priceUp),
    priceDown: list(answer?.priceDown),
    demand: (DEMAND.includes(answer?.demand) ? answer.demand : 'normal') as MarketOpinion['demand'],
    demandNote: answer?.demandNote?.trim() || undefined,
    timeToSell: answer?.timeToSell?.trim() || undefined,
    bestChannel: answer?.bestChannel?.trim() || undefined,
    note,
  }
}

export interface MarketComparison {
  state: 'ohne Spanne' | 'deckt sich' | 'KI höher' | 'KI niedriger'
  /** Abweichung der Mitte von der eigenen Zahl in Prozent */
  deltaPct: number
  midEur?: number
  /** Benennt den Unterschied, statt ihn zu verstecken */
  text: string
}

/**
 * Eigene Rechnung gegen Einschätzung.
 *
 * Zwei Zahlen nebeneinander ohne Einordnung sind schlechter als eine: Der
 * Nutzer nimmt sonst die höhere. Deshalb sagt die App, welche Abweichung sie
 * sieht und woher sie meistens kommt.
 */
export function compareToOwn(ownPrivateSale: number, opinion: MarketOpinion): MarketComparison {
  const own = positive(ownPrivateSale)
  const min = positive(opinion?.privateMinEur)
  const max = positive(opinion?.privateMaxEur)

  if (!own || !min || !max) {
    return {
      state: 'ohne Spanne',
      deltaPct: 0,
      text: 'Zu dieser Baureihe nennt die Einschätzung keine Preisspanne. Es bleibt bei der eigenen Rechnung.',
    }
  }

  const mid = Math.round((min + max) / 2)
  const deltaPct = Math.round(((mid - own) / own) * 1000) / 10

  if (own >= min && own <= max) {
    return {
      state: 'deckt sich',
      deltaPct,
      midEur: mid,
      text: 'Unsere Rechnung liegt innerhalb der geschätzten Spanne. Beide Wege kommen unabhängig voneinander auf dasselbe Bild.',
    }
  }

  if (own < min) {
    return {
      state: 'KI höher',
      deltaPct,
      midEur: mid,
      text:
        `Die Einschätzung liegt rund ${Math.abs(deltaPct).toLocaleString('de-DE')} % über unserer Rechnung. ` +
        'Ausstattung, Farbe und Region kennt die Rechnung nicht – trifft davon etwas auf Dein Fahrzeug zu, ' +
        'kannst Du höher einsteigen. Als Untergrenze bleibt trotzdem die gerechnete Zahl.',
    }
  }

  return {
    state: 'KI niedriger',
    deltaPct,
    midEur: mid,
    text:
      `Die Einschätzung liegt rund ${Math.abs(deltaPct).toLocaleString('de-DE')} % unter unserer Rechnung. ` +
      'Das passiert, wenn eine Baureihe am Markt weniger gefragt ist, als ihr Neupreis vermuten lässt. ' +
      'Plane dann mehr Zeit für den Verkauf ein oder geh von der niedrigeren Zahl aus.',
  }
}
