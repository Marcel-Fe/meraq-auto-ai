import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowUp,
  ImagePlus,
  KeyRound,
  MessageSquarePlus,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { PageHeader, Page } from '../../app/AppShell'
import { Button, Card, cn } from '../../components/ui'
import { InfinityMark } from '../../components/Brand'
import { Markdown } from '../../components/Markdown'
import { useChat } from './useChat'
import { SUGGESTED_QUESTIONS } from '../../lib/ai/prompts'
import { hasApiKey } from '../../lib/ai/client'
import { fileToDataUrl } from '../../lib/fileStore'
import { useAppStore } from '../../store/useAppStore'

export default function AssistantScreen() {
  const { messages, send, stop, busy, vehicle } = useChat()
  const { newThread, activeThreadId, removeThread } = useAppStore()
  const [input, setInput] = useState('')
  const [image, setImage] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const keySet = hasApiKey()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const submit = async (text?: string) => {
    const value = text ?? input
    if (!value.trim() && !image) return
    setInput('')
    const img = image
    setImage(undefined)
    if (textRef.current) textRef.current.style.height = 'auto'
    setSending(true)
    await send(value, img)
    setSending(false)
  }

  const pickImage = async (file?: File) => {
    if (!file) return
    setImage(await fileToDataUrl(file, 1400))
  }

  return (
    // zusätzlicher Platz, damit die Eingabeleiste nichts verdeckt
    <Page className="pb-56">
      <PageHeader
        title="KI Assistent"
        subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
        right={
          <div className="flex items-center gap-1">
            {messages.length > 0 && activeThreadId && (
              <button
                type="button"
                aria-label="Unterhaltung löschen"
                onClick={() => removeThread(activeThreadId)}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="button"
              aria-label="Neue Unterhaltung"
              onClick={() => newThread()}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
            >
              <MessageSquarePlus size={19} />
            </button>
          </div>
        }
      />

      {!keySet && (
        <Card className="mb-4 border-brand-blue/30">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue/15 text-brand-blue">
              <KeyRound size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold">Assistent noch nicht aktiviert</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Der Assistent nutzt Deinen eigenen Anthropic-API-Schlüssel. Er wird ausschließlich auf
                diesem Gerät gespeichert.
              </p>
              <Link to="/settings" className="mt-3 inline-block">
                <Button size="sm">Jetzt einrichten</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {messages.length === 0 ? (
        <div className="anim-fade-up">
          <Card className="glass-strong mb-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-violet/18 text-brand-violet">
                <Sparkles size={21} />
              </span>
              <div>
                <p className="text-[15px] font-semibold">Hallo! 👋</p>
                <p className="text-[12.5px] text-ink-muted">
                  {vehicle
                    ? `Ich kenne Deinen ${vehicle.make} ${vehicle.model}. Wie kann ich helfen?`
                    : 'Frag mich alles rund um Dein Fahrzeug.'}
                </p>
              </div>
            </div>
          </Card>

          <p className="mb-2.5 px-1 text-[12.5px] font-medium text-ink-faint">
            Häufige Fragen
          </p>
          <div className="space-y-2.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submit(q)}
                disabled={!keySet}
                className="glass flex w-full items-center gap-3 rounded-[15px] px-4 py-3.5 text-left text-[13.5px] transition active:scale-[.99] disabled:opacity-45"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/6">
                  <InfinityMark size={11} />
                </span>
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[86%] rounded-[18px] px-4 py-3 text-[14.5px]',
                  m.role === 'user'
                    ? 'brand-gradient rounded-br-[6px] text-white'
                    : 'glass rounded-bl-[6px] text-ink',
                )}
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt="Angehängtes Foto"
                    className="mb-2 max-h-52 w-full rounded-xl object-cover"
                  />
                )}
                {m.role === 'assistant' ? (
                  m.content ? (
                    <Markdown text={m.content} />
                  ) : m.pending ? (
                    <TypingDots />
                  ) : null
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
                {m.pending && m.content && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
                {m.error && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-danger/12 px-2.5 py-2 text-[12.5px] leading-snug text-danger">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    {m.error}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* Eingabeleiste über der Bottom-Nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] px-4 pb-[86px]">
        <div className="glass-strong rounded-[20px] p-2">
          {image && (
            <div className="relative mb-2 inline-block">
              <img src={image} alt="Vorschau" className="h-20 rounded-xl object-cover" />
              <button
                type="button"
                aria-label="Bild entfernen"
                onClick={() => setImage(undefined)}
                className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-danger text-white"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            <button
              type="button"
              aria-label="Foto anhängen"
              onClick={() => fileRef.current?.click()}
              disabled={!keySet}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-muted active:bg-white/8 disabled:opacity-40"
            >
              <ImagePlus size={20} />
            </button>
            <textarea
              ref={textRef}
              value={input}
              rows={1}
              disabled={!keySet}
              placeholder={keySet ? 'Frage stellen…' : 'Erst API-Schlüssel eintragen'}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-faint disabled:opacity-50"
            />
            {busy || sending ? (
              <button
                type="button"
                aria-label="Antwort stoppen"
                onClick={stop}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/12 text-ink"
              >
                <Square size={15} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Senden"
                onClick={() => submit()}
                disabled={!keySet || (!input.trim() && !image)}
                className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition active:scale-95 disabled:opacity-35"
              >
                <ArrowUp size={19} strokeWidth={2.6} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-muted"
          style={{ animation: `meraq-fade .9s ease-in-out ${i * 0.15}s infinite alternate` }}
        />
      ))}
    </span>
  )
}
