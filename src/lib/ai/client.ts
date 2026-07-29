import type Anthropic from '@anthropic-ai/sdk'
import { useAppStore } from '../../store/useAppStore'
import { splitDataUrl } from '../fileStore'

/**
 * Einziger Zugangspunkt zur Claude-API.
 *
 * Der Schlüssel des Nutzers liegt ausschließlich auf seinem Gerät (localStorage)
 * und wird direkt vom Browser an api.anthropic.com geschickt – kein eigener Server.
 * Deshalb ist `dangerouslyAllowBrowser` hier bewusst gesetzt: der Schlüssel gehört
 * dem Nutzer selbst und wird nirgendwo geteilt.
 *
 * Das SDK wird erst beim ersten KI-Aufruf nachgeladen (~90 kB), damit der
 * App-Start auf dem Handy schnell bleibt.
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

async function createClient(apiKey?: string) {
  const key = (apiKey ?? useAppStore.getState().settings.apiKey).trim()
  if (!key) throw new MissingApiKeyError()
  const Sdk = await loadSdk()
  return new Sdk({ apiKey: key, dangerouslyAllowBrowser: true })
}

export function hasApiKey() {
  return useAppStore.getState().settings.apiKey.trim().length > 0
}

export interface AskOptions {
  system: string
  /** Wird als eigener, zwischengespeicherter System-Block angehängt */
  context?: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  signal?: AbortSignal
  onText?: (delta: string) => void
}

/**
 * Streamt eine Antwort und liefert den vollständigen Text zurück.
 *
 * Prompt-Caching: System-Prompt und Fahrzeugkontext ändern sich zwischen
 * Nachrichten nicht, deshalb liegt der cache_control-Breakpoint auf dem letzten
 * System-Block. Alles Wechselnde (die eigentliche Frage) steht danach.
 */
export async function askClaude(opts: AskOptions): Promise<string> {
  const client = await createClient()
  const model = useAppStore.getState().settings.model

  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: opts.system }]
  if (opts.context) system.push({ type: 'text', text: opts.context })
  system[system.length - 1].cache_control = { type: 'ephemeral' }

  const stream = client.messages.stream(
    {
      model,
      max_tokens: opts.maxTokens ?? 2048,
      system,
      messages: opts.messages,
    },
    { signal: opts.signal },
  )

  if (opts.onText) stream.on('text', opts.onText)

  const final = await stream.finalMessage()
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
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
    return 'Es ist noch kein API-Schlüssel hinterlegt. Trage ihn in den Einstellungen ein, dann kann der Assistent antworten.'
  }
  if (err instanceof DOMException && err.name === 'AbortError') return 'Abgebrochen.'
  if (isAbortName(err)) return 'Abgebrochen.'

  const status = getStatus(err)
  switch (status) {
    case 401:
      return 'Der API-Schlüssel wurde abgelehnt. Bitte prüfe ihn in den Einstellungen – er beginnt mit "sk-ant-".'
    case 403:
      return 'Dieser Schlüssel hat keinen Zugriff auf das gewählte Modell. Wähle in den Einstellungen ein anderes Modell.'
    case 404:
      return 'Das gewählte Modell ist für diesen Schlüssel nicht verfügbar. Wähle in den Einstellungen ein anderes Modell.'
    case 429:
      return 'Zu viele Anfragen in kurzer Zeit oder Guthaben aufgebraucht. Warte einen Moment und versuche es erneut.'
    case 400:
      return `Die Anfrage wurde abgelehnt: ${messageOf(err)}`
    case 500:
    case 502:
    case 503:
    case 529:
      return 'Die KI ist gerade überlastet. Bitte in einer Minute noch einmal versuchen.'
  }

  if (err instanceof Error && /network|fetch|connection/i.test(err.message)) {
    return 'Keine Verbindung zur KI. Prüfe Deine Internetverbindung und versuche es noch einmal.'
  }
  return 'Unerwarteter Fehler bei der KI-Anfrage. Bitte noch einmal versuchen.'
}

function getStatus(err: unknown): number | undefined {
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

/** Prüft einen Schlüssel mit einer minimalen Anfrage */
export async function verifyApiKey(apiKey: string, model: string): Promise<{ ok: boolean; message: string }> {
  try {
    const client = await createClient(apiKey)
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
