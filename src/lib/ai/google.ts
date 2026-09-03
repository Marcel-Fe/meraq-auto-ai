import type Anthropic from '@anthropic-ai/sdk'

/**
 * Anbieter Google Gemini – der kostenlose Weg zum Assistenten.
 *
 * Ein Schlüssel aus Google AI Studio ist gratis und ohne Kreditkarte zu bekommen.
 * Er liegt wie der Anthropic-Schlüssel ausschließlich auf dem Gerät des Nutzers und
 * geht direkt an Google – MERAQ hat keinen Server dazwischen.
 *
 * Bewusst ohne SDK: Die REST-Schnittstelle ist schmal genug, und so bleibt der
 * kostenlose Weg ohne zusätzliche 100 kB im Bundle.
 *
 * Intern bleibt das Nachrichtenformat von Anthropic das Hausformat – hier wird nur
 * übersetzt. So muss kein einziger Feature-Screen zwei Anbieter kennen.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Fehler mit HTTP-Status, damit describeAiError() ihn wie einen SDK-Fehler behandeln kann */
export class AiHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AiHttpError'
    this.status = status
  }
}

interface GooglePart {
  text?: string
  inlineData?: { mimeType: string; data: string }
  functionCall?: { name: string; args: unknown }
}

interface GoogleContent {
  role: 'user' | 'model'
  parts: GooglePart[]
}

/** Anthropic-Nachrichten in Googles `contents` übersetzen */
function toContents(messages: Anthropic.MessageParam[]): GoogleContent[] {
  return messages.map((m) => {
    const role = m.role === 'assistant' ? ('model' as const) : ('user' as const)
    if (typeof m.content === 'string') return { role, parts: [{ text: m.content }] }

    const parts: GooglePart[] = []
    for (const block of m.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text })
      } else if (block.type === 'image' && block.source.type === 'base64') {
        parts.push({
          inlineData: { mimeType: block.source.media_type, data: block.source.data },
        })
      }
    }
    return { role, parts: parts.length ? parts : [{ text: '…' }] }
  })
}

/**
 * JSON-Schema für Google säubern.
 *
 * Google nimmt eine Teilmenge von JSON-Schema an und antwortet auf unbekannte
 * Schlüssel mit 400. Entfernt werden deshalb die Felder, die Anthropic zwar
 * erlaubt, Google aber nicht kennt.
 */
const UNSUPPORTED = new Set(['$schema', 'additionalProperties', 'default', 'examples', 'title'])

function cleanSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(cleanSchema)
  if (!schema || typeof schema !== 'object') return schema

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (UNSUPPORTED.has(key)) continue
    out[key] = cleanSchema(value)
  }
  return out
}

interface CallOptions {
  apiKey: string
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  maxTokens: number
  signal?: AbortSignal
}

function body(opts: CallOptions, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: toContents(opts.messages),
    // Grosszügig bemessen: Neuere Gemini-Modelle verbrauchen einen Teil des Budgets
    // für internes Nachdenken. Zu knapp bemessen käme eine leere Antwort zurück.
    generationConfig: { maxOutputTokens: Math.max(4096, opts.maxTokens * 2) },
    ...extra,
  })
}

async function fail(res: Response): Promise<never> {
  let message = `HTTP ${res.status}`
  try {
    const data = await res.json()
    message = data?.error?.message ?? message
  } catch {
    /* Antwort war kein JSON – der Status genügt */
  }
  throw new AiHttpError(res.status, message)
}

/** Streamt eine Antwort und liefert den vollständigen Text */
export async function askGoogle(
  opts: CallOptions & { onText?: (delta: string) => void },
): Promise<string> {
  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(opts),
      signal: opts.signal,
    },
  )
  if (!res.ok || !res.body) await fail(res)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let acc = ''

  const consume = (event: string) => {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const chunk = JSON.parse(payload)
        for (const part of chunk?.candidates?.[0]?.content?.parts ?? []) {
          if (typeof part.text === 'string' && part.text) {
            acc += part.text
            opts.onText?.(part.text)
          }
        }
      } catch {
        /* unvollständiges Ereignis – kommt mit dem nächsten Puffer nach */
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Server-sent events sind durch eine Leerzeile getrennt. Google schickt sie
    // mit CRLF – nur auf "\n\n" zu trennen findet kein einziges Ereignis, und
    // die Antwort bliebe still leer.
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''
    for (const event of events) consume(event)
  }

  // Das letzte Ereignis hat oft keine Leerzeile hinter sich – ohne diesen
  // Abschluss fehlte der Schlusssatz jeder Antwort
  if (buffer.trim()) consume(buffer)

  return acc
}

/**
 * Antwort in fester Struktur.
 *
 * Umgesetzt über einen erzwungenen Funktionsaufruf (`mode: ANY`) – dasselbe
 * Vorgehen wie bei Anthropic, damit garantiert gültiges JSON zurückkommt.
 */
export async function askGoogleStructured<T>(
  opts: CallOptions & { toolName: string; toolDescription: string; schema: unknown },
): Promise<T> {
  const res = await fetch(
    `${BASE}/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body(opts, {
        tools: [
          {
            functionDeclarations: [
              {
                name: opts.toolName,
                description: opts.toolDescription,
                parameters: cleanSchema(opts.schema),
              },
            ],
          },
        ],
        toolConfig: {
          functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [opts.toolName] },
        },
      }),
      signal: opts.signal,
    },
  )
  if (!res.ok) await fail(res)

  const data = await res.json()
  const parts: GooglePart[] = data?.candidates?.[0]?.content?.parts ?? []
  const call = parts.find((p) => p.functionCall)?.functionCall
  if (!call) throw new Error('Die KI hat keine strukturierte Antwort geliefert.')
  return call.args as T
}

export interface GoogleModel {
  /** Name ohne das Präfix "models/" */
  id: string
  label: string
}

/**
 * Verfügbare Modelle zum Schlüssel holen.
 *
 * Bewusst abgefragt statt fest hinterlegt: Google benennt Modelle regelmäßig um,
 * und ein geratener Name wäre erst beim ersten echten Aufruf als Fehler sichtbar.
 */
export async function listGoogleModels(apiKey: string, signal?: AbortSignal): Promise<GoogleModel[]> {
  const res = await fetch(`${BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`, { signal })
  if (!res.ok) await fail(res)

  const data = await res.json()
  const models: GoogleModel[] = (data?.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[]; name?: string }) =>
      m.supportedGenerationMethods?.includes('generateContent'),
    )
    .map((m: { name: string; displayName?: string }) => ({
      id: m.name.replace(/^models\//, ''),
      label: m.displayName || m.name.replace(/^models\//, ''),
    }))
    .filter((m: GoogleModel) => !/embedding|aqa|imagen|veo|tts|image|audio/i.test(m.id))

  // Flash-Modelle nach vorn: Sie sind im kostenlosen Kontingent am großzügigsten
  return models.sort((a, b) => Number(b.id.includes('flash')) - Number(a.id.includes('flash')))
}
