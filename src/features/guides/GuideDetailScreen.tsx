import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Clock, Package, RotateCcw, ShieldAlert, Sparkles, Wrench } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, ProgressBar, SectionTitle, cn } from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { GUIDES } from '../../data/guides'
import { askAi, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_ASSISTANT, vehicleContext } from '../../lib/ai/prompts'
import { useActiveVehicle, useAppStore, useGuideProgress } from '../../store/useAppStore'

const DIFFICULTY_TONE = { einfach: 'ok', mittel: 'warn', schwer: 'danger' } as const

export default function GuideDetailScreen() {
  const { id } = useParams()
  const vehicle = useActiveVehicle()
  const guide = GUIDES.find((g) => g.id === id)
  // Der Fortschritt liegt im Store, nicht in der Komponente: Wer unter dem Auto
  // liegt und die App wegwischt, will nicht wieder bei Schritt 1 anfangen
  const steps = useGuideProgress(vehicle?.id, guide?.id)
  const toggleGuideStep = useAppStore((s) => s.toggleGuideStep)
  const resetGuideProgress = useAppStore((s) => s.resetGuideProgress)
  const done = useMemo(() => new Set(steps), [steps])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  if (!guide) {
    return (
      <Page>
        <PageHeader title="Anleitung" backTo="/guides" />
        <Card>
          <p className="text-center text-[14px] text-ink-muted">Anleitung nicht gefunden.</p>
        </Card>
      </Page>
    )
  }

  const toggle = (i: number) => {
    if (vehicle) toggleGuideStep(vehicle.id, guide.id, i)
  }

  const askForVehicle = async () => {
    if (!hasApiKey()) {
      setAnswer('_Für die KI-Antwort brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen)._')
      return
    }
    setLoading(true)
    setAnswer('')
    let acc = ''
    try {
      await askAi({
        system: SYSTEM_ASSISTANT,
        context: vehicleContext(vehicle),
        messages: [
          {
            role: 'user',
            content: `Ich möchte "${guide.title}" an meinem Fahrzeug selbst machen. Was ist bei genau diesem Modell zu beachten? Nenne Besonderheiten, benötigtes Spezialwerkzeug und typische Stolperfallen.`,
          },
        ],
        onText: (d) => {
          acc += d
          setAnswer(acc)
        },
      })
    } catch (err) {
      setAnswer(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader title={guide.title} subtitle={guide.category} backTo="/guides" />

      <div className="anim-fade-up space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge tone={DIFFICULTY_TONE[guide.difficulty]}>{guide.difficulty}</Badge>
          <Badge>
            <Clock size={11} />
            {guide.durationMin} Minuten
          </Badge>
          <Badge>{guide.steps.length} Schritte</Badge>
        </div>

        {guide.safety && (
          <Card className="border-warn/30 bg-warn/6">
            <div className="flex items-start gap-3">
              <ShieldAlert size={19} className="mt-0.5 shrink-0 text-warn" />
              <div>
                <p className="text-[13.5px] font-semibold text-warn">Sicherheit zuerst</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  {guide.safety}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-2.5">
          <Card>
            <div className="mb-2 flex items-center gap-2 text-brand-teal">
              <Wrench size={16} />
              <p className="text-[13px] font-semibold text-ink">Werkzeug</p>
            </div>
            <ul className="space-y-1">
              {guide.tools.map((t) => (
                <li key={t} className="flex gap-2 text-[13px] text-ink-muted">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>

          {guide.parts.length > 0 && (
            <Card>
              <div className="mb-2 flex items-center gap-2 text-brand-violet">
                <Package size={16} />
                <p className="text-[13px] font-semibold text-ink">Material</p>
              </div>
              <ul className="space-y-1">
                {guide.parts.map((p) => (
                  <li key={p} className="flex gap-2 text-[13px] text-ink-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-violet" />
                    {p}
                  </li>
                ))}
              </ul>
              <Link
                to="/parts"
                className="mt-3 inline-block text-[13px] font-medium text-brand-blue"
              >
                Preise vergleichen
              </Link>
            </Card>
          )}
        </div>

        <section>
          <SectionTitle
            title="Schritt für Schritt"
            action={
              done.size === guide.steps.length
                ? 'alles erledigt'
                : `Schritt ${done.size + 1} von ${guide.steps.length}`
            }
          />

          {done.size > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <ProgressBar
                value={done.size / guide.steps.length}
                tone={done.size === guide.steps.length ? 'ok' : 'warn'}
              />
              <button
                type="button"
                onClick={() => vehicle && resetGuideProgress(vehicle.id, guide.id)}
                className="-my-2 flex h-11 shrink-0 items-center gap-1.5 px-1 text-[12.5px] font-medium text-ink-muted active:opacity-70"
              >
                <RotateCcw size={13} />
                Zurücksetzen
              </button>
            </div>
          )}

          <div className="space-y-2.5">
            {guide.steps.map((s, i) => {
              const isDone = done.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggle(i)}
                  className={cn(
                    'glass flex w-full items-start gap-3 rounded-[18px] p-4 text-left transition active:scale-[.99]',
                    isDone && 'opacity-55',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition',
                      isDone
                        ? 'bg-ok text-[#04140a]'
                        : 'bg-white/8 text-brand-teal',
                    )}
                  >
                    {isDone ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-[14.5px] font-semibold',
                        isDone && 'line-through',
                      )}
                    >
                      {s.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">
                      {s.text}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {answer ? (
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-brand-violet" />
              <span className="text-[13px] font-semibold">
                Besonderheiten bei {vehicle ? `${vehicle.make} ${vehicle.model}` : 'Deinem Fahrzeug'}
              </span>
            </div>
            <div className="text-[14px] text-ink-muted">
              <Markdown text={answer} />
              {loading && <span className="inline-block animate-pulse">▍</span>}
            </div>
          </Card>
        ) : (
          <Button variant="outline" full loading={loading} icon={<Sparkles size={17} />} onClick={askForVehicle}>
            Was gilt für mein Fahrzeug?
          </Button>
        )}
      </div>
    </Page>
  )
}
