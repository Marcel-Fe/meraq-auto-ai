import type Anthropic from '@anthropic-ai/sdk'
import { useAppStore, type AiProvider } from '../../store/useAppStore'
import { splitDataUrl } from '../fileStore'
import { AiHttpError, askGoogle, askGoogleStructured, listGoogleModels } from './google'

/**
 * Einziger Zugangspunkt zur KI – für beide Anbieter.
 *
 * **Google** ist der kostenlose Weg: Ein Schlüssel aus Google AI Studio kostet
 * nichts und braucht keine Kreditkarte. **Anthropic** liefert die beste Qualität,
 * kostet aber pro Anfrage.
 *
 * In beiden Fällen gilt dasselbe Versprechen: Der Schlüssel gehört dem Nutzer,
 * liegt nur auf seinem Gerät und geht direkt an den Anbieter – MERAQ hat keinen
 * Server dazwischen. Deshalb ist `dangerouslyAllowBrowser` bewusst gesetzt.
 *
 * Das Nachrichtenformat von Anthropic ist das Hausformat; der Google-Adapter
 * übersetzt es. So kennt kein Feature-Screen zwei Anbieter.
 */

export class MissingApiKeyError extends Error {
  constructor() {
    super('Kein API-Schlüssel hinterlegt.')
    this.name = 'MissingApiKeyError'
  }
}

let sdkPromise: Promise<typeof import('@anthropic-ai/sdk').default> | null = null

function loadSdk() {
  if (!sdkPromise) sdkPromise = import('@anthropic-ai/sdk').then((m) => m.default)
  return sdkPromise
}

/** Welcher Anbieter ist eingestellt, mit welchem Schlüssel und Modell? */
function current(): { provider: AiProvider; key: string; model: string } {
  const s = useAppStore.getState().settings
  return s.provider === 'google'
    ? { provider: 'google', key: s.googleApiKey.trim(), model: s.googleModel }
    : { provider: 'anthropic', key: s.apiKey.trim(), model: s.model }
}

async function createAnthropic(apiKey: string) {
  const Sdk = await loadSdk()
  return new Sdk({ apiKey, dangerouslyAllowBrowser: true })
}

export function hasApiKey() {
  return current().key.length > 0
}

/** Name des eingestellten Anbieters für die Anzeige */
export function providerLabel(provider: AiProvider = current().provider) {
  return provider === 'google' ? 'Google Gemini' : 'Anthropic Claude'
}

export interface AskOptions {
  system: string
  /** Wird bei Anthropic als eigener, zwischengespeicherter System-Block angehängt */
  context?: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  signal?: AbortSignal
  onText?: (delta: string) => void
}

/**
 * Streamt eine Antwort und liefert den vollständigen Text zurück.
 *
 * Prompt-Caching bei Anthropic: System-Prompt und Fahrzeugkontext ändern sich
 * zwischen Nachrichten nicht, deshalb liegt der cache_control-Breakpoint auf dem
 * letzten System-Block. Alles Wechselnde (die eigentliche Frage) steht danach.
 * Google übernimmt das Zwischenspeichern selbst.
 */
export async function askAi(opts: AskOptions): Promise<string> {
  const { provider, key, model } = current()
  if (!key) throw new MissingApiKeyError()

  if (provider === 'google') {
    return askGoogle({
      apiKey: key,
      model,
      system: opts.context ? `${opts.system}\n\n${opts.context}` : opts.system,
      messages: opts.messages,
      maxTokens: opts.maxTokens ?? 2048,
      signal: opts.signal,
      onText: opts.onText,
    })
  }

  const client = await createAnthropic(key)
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: opts.system }]
  if (opts.context) system.push({ type: 'text', text: opts.context })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const stream = client.messages.stream(
    { model, max_tokens: opts.maxTokens ?? 2048, system, messages: opts.messages },
    { signal: opts.signal },
  )

  if (opts.onText) stream.on('text', opts.onText)

  const final = await stream.finalMessage()
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/**
 * Antwort in einer festen Struktur anfordern.
 *
 * Umgesetzt über einen erzwungenen Werkzeugaufruf: Das Modell muss das Werkzeug
 * benutzen und liefert damit garantiert gültiges JSON nach dem übergebenen Schema –
 * zuverlässiger, als JSON aus einem Fließtext zu parsen. Beide Anbieter können das.
 */
export async function askAiStructured<T>(opts: {
  system: string
  context?: string
  messages: Anthropic.MessageParam[]
  toolName: string
  toolDescription: string
  schema: Anthropic.Tool.InputSchema
  maxTokens?: number
  signal?: AbortSignal
}): Promise<T> {
  const { provider, key, model } = current()
  if (!key) throw new MissingApiKeyError()

  if (provider === 'google') {
    return askGoogleStructured<T>({
      apiKey: key,
      model,
      system: opts.context ? `${opts.system}\n\n${opts.context}` : opts.system,
      messages: opts.messages,
      maxTokens: opts.maxTokens ?? 2048,
      signal: opts.signal,
      toolName: opts.toolName,
      toolDescription: opts.toolDescription,
      schema: opts.schema,
    })
  }

  const client = await createAnthropic(key)
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: opts.system }]
  if (opts.context) system.push({ type: 'text', text: opts.context })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const response = await client.messages.create(
    {
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system,
      messages: opts.messages,
      tools: [
        { name: opts.toolName, description: opts.toolDescription, input_schema: opts.schema },
      ],
      tool_choice: { type: 'tool', name: opts.toolName },
    },
    { signal: opts.signal },
  )

  const block = response.content.find((b) => b.type === 'tool_use')
  if (!block || block.type !== 'tool_use') {
    throw new Error('Die KI hat keine strukturierte Antwort geliefert.')
  }
  return block.input as T
}

/** Baut einen Nutzer-Turn, optional mit Bild */
export function userMessage(text: string, imageDataUrl?: string): Anthropic.MessageParam {
  if (!imageDataUrl) return { role: 'user', content: text }

  const parsed = splitDataUrl(imageDataUrl)
  if (!parsed) return { role: 'user', content: text }

  return {
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: parsed.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: parsed.data,
        },
      },
      { type: 'text', text: text || 'Was siehst du auf diesem Bild?' },
    ],
  }
}

/**
 * Rohfehler in eine Meldung übersetzen, die dem Nutzer wirklich hilft.
 * Geprüft wird über den HTTP-Status statt über `instanceof`, damit das SDK
 * dafür nicht geladen sein muss.
 */
export function describeAiError(err: unknown): string {
  if (err instanceof MissingApiKeyError) {
    return 'Es ist noch kein API-Schlüssel hinterlegt. Trage ihn in den Einstellungen ein – bei Google bekommst Du ihn kostenlos.'
  }
  if (err instanceof DOMException && err.name === 'AbortError') return 'Abgebrochen.'
  if (isAbortName(err)) return 'Abgebrochen.'

  const status = getStatus(err)
  const text = messageOf(err)

  // Google meldet einen ungültigen Schlüssel mit 400 statt 401
  if (status === 400 && /api[- ]key not valid|api key expired|invalid api key/i.test(text)) {
    return 'Der Schlüssel wurde abgelehnt. Prüfe ihn in den Einstellungen – bei Google findest Du ihn unter aistudio.google.com/apikey.'
  }

  switch (status) {
    case 401:
      return 'Der API-Schlüssel wurde abgelehnt. Bitte prüfe ihn in den Einstellungen.'
    case 403:
      return 'Dieser Schlüssel hat keinen Zugriff auf das gewählte Modell. Wähle in den Einstellungen ein anderes Modell.'
    case 404:
      return 'Das gewählte Modell ist für diesen Schlüssel nicht verfügbar. Wähle in den Einstellungen ein anderes Modell.'
    case 429:
      return 'Zu viele Anfragen in kurzer Zeit oder das Kontingent ist aufgebraucht. Warte einen Moment und versuche es erneut.'
    case 400:
      return `Die Anfrage wurde abgelehnt: ${text}`
    case 500:
    case 502:
    case 503:
    case 529:
      return 'Die KI ist gerade überlastet. Bitte in einer Minute noch einmal versuchen.'
  }

  if (err instanceof Error && /network|fetch|connection|failed to fetch/i.test(err.message)) {
    return 'Keine Verbindung zur KI. Prüfe Deine Internetverbindung und versuche es noch einmal.'
  }
  return 'Unerwarteter Fehler bei der KI-Anfrage. Bitte noch einmal versuchen.'
}

function getStatus(err: unknown): number | undefined {
  if (err instanceof AiHttpError) return err.status
  if (err && typeof err === 'object' && 'status' in err) {
    const s = (err as { status?: unknown }).status
    if (typeof s === 'number') return s
  }
  return undefined
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'unbekannter Grund'
}

function isAbortName(err: unknown) {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'APIUserAbortError')
}

export interface KeyCheck {
  ok: boolean
  message: string
  /** Bei Google: die zum Schlüssel verfügbaren Modelle */
  models?: { id: string; label: string }[]
}

/**
 * Prüft einen Schlüssel mit einer minimalen Anfrage.
 *
 * Bei Google wird zusätzlich die Modell-Liste geholt: Google benennt Modelle
 * regelmäßig um, und ein fest hinterlegter Name wäre erst beim ersten echten
 * Aufruf als Fehler sichtbar.
 */
export async function verifyApiKey(
  provider: AiProvider,
  apiKey: string,
  model: string,
): Promise<KeyCheck> {
  try {
    if (provider === 'google') {
      const models = await listGoogleModels(apiKey)
      if (!models.length) {
        return { ok: false, message: 'Der Schlüssel liefert keine nutzbaren Modelle zurück.' }
      }
      const known = models.some((m) => m.id === model)
      return {
        ok: true,
        models,
        message: known
          ? `Schlüssel funktioniert. ${models.length} Modelle verfügbar.`
          : `Schlüssel funktioniert. Das eingestellte Modell gibt es nicht mehr – wähle unten eines der ${models.length} verfügbaren.`,
      }
    }

    const client = await createAnthropic(apiKey)
    await client.messages.create({
      model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Antworte nur mit: OK' }],
    })
    return { ok: true, message: 'Schlüssel funktioniert. Der Assistent ist einsatzbereit.' }
  } catch (err) {
    return { ok: false, message: describeAiError(err) }
  }
}
