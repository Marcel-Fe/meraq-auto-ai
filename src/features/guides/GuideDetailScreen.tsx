import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, ProgressBar, SectionTitle, cn } from '../../components/ui'
import { GUIDES } from '../../data/guides'
import { findHotspotId } from '../../data/manual'
import { repairJobsFor } from '../../data/parts'
import { describeAiError, hasApiKey } from '../../lib/ai/client'
import { adaptGuide, cachedAdaptation } from '../../lib/guideAdapt'
import { guideCostComparison } from '../../lib/guideCost'
import type { GuideAdaptation } from '../../types'
import { formatKm, todayIso } from '../../lib/format'
import {
  useActiveVehicle,
  useAppStore,
  useGuideProgress,
  useVehicleMaintenance,
} from '../../store/useAppStore'
import { GuideAdaptationView } from './GuideAdaptationView'
import { GuideCostCompare } from './GuideCostCompare'

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
  // Schon in dieser Sitzung geholt? Dann sofort zeigen, statt erneut zu fragen
  const [adapt, setAdapt] = useState<GuideAdaptation | null>(() =>
    vehicle && guide ? (cachedAdaptation(guide, vehicle) ?? null) : null,
  )
  const [adaptError, setAdaptError] = useState('')
  const [loading, setLoading] = useState(false)
  const hourlyRate = useAppStore((s) => s.settings.hourlyRateEur)
  const maintenance = useVehicleMaintenance()
  const completeMaintenance = useAppStore((s) => s.completeMaintenance)
  const addActivity = useAppStore((s) => s.addActivity)
  const [saved, setSaved] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Die passende Wartungsposition – nur, wenn es sie an diesem Fahrzeug gibt
  const dueItem = useMemo(
    () => (guide?.maintenanceKind ? maintenance.find((m) => m.kind === guide.maintenanceKind) : undefined),
    [maintenance, guide?.maintenanceKind],
  )

  // Die vergleichbare Werkstattposition ist schon auf Marke und Fahrzeugart
  // umgerechnet – der Screen rechnet nur noch den Stundensatz dagegen
  const job = useMemo(() => {
    if (!vehicle || !guide?.jobId) return undefined
    return repairJobsFor(vehicle).find((j) => j.id === guide.jobId)
  }, [vehicle, guide?.jobId])

  // „Wo sitzt das überhaupt?" – die Zuordnung von Begriff zu Bauteil liegt in
  // den Daten, der Screen fragt nur nach. Ohne Treffer bleibt der Weg aus:
  // ein Sprung zum falschen Bauteil wäre schlimmer als keiner
  const hotspotId = useMemo(() => {
    if (!vehicle || !guide) return undefined
    return findHotspotId([guide.title, ...guide.parts].join(' '), vehicle)
  }, [vehicle, guide])

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

  /**
   * Die Anleitung gilt für jedes Fahrzeug – die Abweichungen kennt nur die KI.
   * Die Antwort kommt strukturiert zurück, damit der Hinweis zu Schritt 4 auch
   * bei Schritt 4 steht und nicht in einem Absatz darüber.
   */
  const askForVehicle = async () => {
    if (!vehicle) return
    if (!hasApiKey()) {
      setAdaptError(
        'Für die KI-Antwort brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen).',
      )
      return
    }
    setAdaptError('')
    setLoading(true)
    try {
      setAdapt(await adaptGuide(guide, vehicle))
    } catch (err) {
      setAdaptError(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  const noteForStep = (i: number) => adapt?.stepNotes?.find((n) => n.step === i + 1)?.note

  const vehicleLabel = vehicle ? `Deinem ${vehicle.make} ${vehicle.model}` : 'Deinem Fahrzeug'

  // Für Ungeübte dauert es länger – wenn die KI eine realistische Zeit genannt
  // hat, zählt die, sonst die Angabe der Anleitung
  const cost = guideCostComparison(job, hourlyRate, adapt?.timeNoviceMin ?? guide.durationMin)

  const allDone = done.size === guide.steps.length

  /**
   * Angeboten, nicht automatisch: Gespeichert wird erst, wenn der Nutzer es
   * bestätigt – und er sieht vorher, was in seinen Daten landet.
   */
  const saveWork = () => {
    if (!vehicle) return
    if (dueItem) {
      // Schreibt den Wartungsplan fort *und* legt den Verlaufseintrag an
      completeMaintenance(dueItem.id, 'selbst erledigt nach Anleitung')
    } else {
      addActivity({
        vehicleId: vehicle.id,
        date: todayIso(),
        title: `${guide.title} erledigt`,
        detail: `selbst erledigt nach Anleitung · bei ${formatKm(vehicle.mileage)}`,
        icon: 'repair',
        mileage: vehicle.mileage,
      })
    }
    setSaved(true)
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

        {cost && job && (
          <GuideCostCompare
            cost={cost}
            jobName={job.name}
            safety={guide.safety}
            hourlyRate={hourlyRate}
          />
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

        {hotspotId && (
          <Link to={`/manual?teil=${hotspotId}`}>
            <Card className="border-brand-blue/25 transition active:scale-[.99]">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-blue/15 text-brand-blue">
                  <Box size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">Wo sitzt das am Fahrzeug?</span>
                  <span className="block text-[12.5px] text-ink-muted">
                    Stelle im Modell zeigen, bevor Du anfängst
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-faint" />
              </div>
            </Card>
          </Link>
        )}

        {/* Erst die Abweichungen an diesem Fahrzeug, dann die Schritte – die
            Hinweise stehen anschließend direkt an dem Schritt, zu dem sie gehören */}
        {adapt ? (
          <GuideAdaptationView adapt={adapt} vehicleLabel={vehicleLabel} />
        ) : (
          <div className="space-y-2">
            <Button
              variant="outline"
              full
              loading={loading}
              icon={<Sparkles size={17} />}
              onClick={askForVehicle}
            >
              Was gilt für mein Fahrzeug?
            </Button>
            {adaptError && (
              <p className="text-[12.5px] leading-relaxed text-danger">{adaptError}</p>
            )}
          </div>
        )}

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
              const note = noteForStep(i)
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
                    {note && (
                      <span className="mt-2.5 flex items-start gap-2 rounded-[12px] border border-brand-violet/25 bg-brand-violet/8 px-2.5 py-2">
                        <Sparkles size={13} className="mt-0.5 shrink-0 text-brand-violet" />
                        <span className="block text-[12.5px] leading-relaxed text-ink-muted">
                          {note}
                        </span>
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Nach dem letzten Schritt: die Arbeit dahin bringen, wo sie hingehört –
            aber erst auf Bestätigung. Der Nutzer sieht vorher, was gespeichert wird */}
        {allDone && vehicle && (saved ? (
          <Card className="border-ok/30 bg-ok/6">
            <div className="mb-1.5 flex items-center gap-2 text-ok">
              <CheckCircle2 size={16} />
              <span className="text-[13.5px] font-semibold">Eingetragen</span>
            </div>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              {dueItem
                ? `„${dueItem.label}" steht jetzt auf erledigt bei ${formatKm(vehicle.mileage)} – und im Verlauf.`
                : 'Die Arbeit steht jetzt in Deinem Verlauf.'}
            </p>
            <Link
              to={dueItem ? '/maintenance' : '/more'}
              className="mt-2 inline-block text-[13px] font-medium text-brand-blue"
            >
              {dueItem ? 'Zum Wartungsplan' : 'Zum Verlauf'}
            </Link>
          </Card>
        ) : (
          !dismissed && (
            <Card className="border-ok/30">
              <div className="mb-1.5 flex items-center gap-2 text-ok">
                <CheckCircle2 size={16} />
                <span className="text-[13.5px] font-semibold">Geschafft – soll ich das eintragen?</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {dueItem && (
                  <li className="flex gap-2 text-[13px] text-ink-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ok" />
                    Wartungsplan: „{dueItem.label}" auf erledigt bei {formatKm(vehicle.mileage)}
                  </li>
                )}
                <li className="flex gap-2 text-[13px] text-ink-muted">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ok" />
                  Verlauf: ein Eintrag von heute
                </li>
              </ul>
              <div className="mt-3.5 flex gap-2">
                <Button className="flex-1" onClick={saveWork}>
                  Eintragen
                </Button>
                <Button
                  variant="ghost"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => setDismissed(true)}
                >
                  Nicht jetzt
                </Button>
              </div>
              {!dueItem && guide.maintenanceKind && (
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
                  Im Wartungsplan Deines Fahrzeugs gibt es dafür keine Position – deshalb nur der
                  Verlaufseintrag.
                </p>
              )}
            </Card>
          )
        ))}
      </div>
    </Page>
  )
}
