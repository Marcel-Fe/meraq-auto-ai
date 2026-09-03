import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  FolderOpen,
  HelpCircle,
  Receipt,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, SectionTitle, Skeleton, cn } from '../../components/ui'
import { findHotspotId, hotspotById } from '../../data/manual'
import { repairJobsFor } from '../../data/parts'
import { describeAiError, hasApiKey } from '../../lib/ai/client'
import { fileToDataUrl } from '../../lib/fileStore'
import { formatDate, formatEur, formatKm, todayIso } from '../../lib/format'
import { coversTotal } from '../../lib/invoiceCheck'
import { explainInvoice } from '../../lib/invoiceExplain'
import { useActiveVehicle, useAppStore, useVehicleMaintenance } from '../../store/useAppStore'
import type { InvoiceExplanation } from '../../types'
import { InvoicePositionCard } from './InvoicePositionCard'

/**
 * „Was hat die Werkstatt da eigentlich gemacht?"
 *
 * Die Rechnung ist der Moment, in dem am meisten Geld fließt und am wenigsten
 * verstanden wird. Der Nutzer scannt sie, die KI übersetzt jede Zeile, und die
 * App legt daneben, was sie selbst weiß: das Bauteil im Modell, ein Foto davon
 * und den üblichen Preis für genau dieses Fahrzeug.
 *
 * Die Preisbewertung kommt bewusst nicht von der KI (siehe `invoiceCheck.ts`),
 * und gespeichert wird nur, was der Nutzer bestätigt.
 */
export default function InvoiceScreen() {
  const vehicle = useActiveVehicle()
  const maintenance = useVehicleMaintenance()
  const hourlyRate = useAppStore((s) => s.settings.hourlyRateEur)
  const addActivity = useAppStore((s) => s.addActivity)
  const updateMaintenance = useAppStore((s) => s.updateMaintenance)

  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<InvoiceExplanation | null>(null)
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const jobs = useMemo(() => (vehicle ? repairJobsFor(vehicle) : []), [vehicle])

  // Welche Wartungspositionen dieser Beleg erledigt hat – nur solche, die es am
  // Fahrzeug wirklich gibt
  const matching = useMemo(() => {
    const kinds = result?.maintenanceKinds ?? []
    return maintenance.filter((m) => kinds.includes(m.kind))
  }, [maintenance, result])

  const read = async (file: File) => {
    if (!vehicle) return
    setError('')
    setResult(null)
    setSaved(false)
    if (!hasApiKey()) {
      setError('Für das Erklären der Rechnung brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos.')
      return
    }
    setLoading(true)
    try {
      const dataUrl = await fileToDataUrl(file, 1800)
      setImage(dataUrl)
      if (!dataUrl.startsWith('data:image')) {
        setError('Das war keine Bilddatei. Fotografiere die Rechnung oder wähle ein Bild – PDF kann die KI hier nicht lesen.')
        return
      }
      const answer = await explainInvoice(dataUrl, vehicle, jobs)
      setResult(answer)
      setPickedIds([])
    } catch (err) {
      setError(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void read(file)
  }

  const reset = () => {
    setImage('')
    setResult(null)
    setError('')
    setSaved(false)
    setPickedIds([])
  }

  /**
   * Übernommen wird mit den Angaben des Belegs, nicht mit dem heutigen Stand:
   * Eine Rechnung von vor drei Monaten hat ihr eigenes Datum und ihren eigenen
   * Kilometerstand.
   */
  const save = () => {
    if (!vehicle || !result) return
    const date = isoOf(result.date)
    addActivity({
      vehicleId: vehicle.id,
      date,
      title: result.summary.slice(0, 60) || 'Werkstattrechnung',
      detail: [result.workshop, result.positions.map((p) => p.label).slice(0, 3).join(', ')]
        .filter(Boolean)
        .join(' · '),
      icon: 'invoice',
      costEur: result.totalGrossEur,
      mileage: result.mileage,
    })
    for (const id of pickedIds) {
      updateMaintenance(
        id,
        result.mileage != null ? { lastDoneAt: date, lastDoneKm: result.mileage } : { lastDoneAt: date },
      )
    }
    setSaved(true)
  }

  if (!vehicle) return null

  const complete = result ? coversTotal(result.positions, result.totalGrossEur) : true

  return (
    <Page>
      <PageHeader title="Rechnung erklären" subtitle={`${vehicle.make} ${vehicle.model}`} backTo="/" />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="hidden"
        aria-label="Rechnung fotografieren"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
        aria-label="Rechnungsbild wählen"
      />

      <div className="anim-fade-up space-y-5">
        {!result && !loading && (
          <Card className="border-brand-teal/30">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-teal/15 text-brand-teal">
                <Receipt size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold">Rechnung einscannen</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  Die KI liest den Beleg und erklärt Dir jede Zeile: was gemacht wurde, warum – und
                  welches Teil an Deinem Fahrzeug gemeint ist.
                </p>
              </div>
            </div>
          </Card>
        )}

        {image && (
          <img
            src={image}
            alt="Gescannte Rechnung"
            className="max-h-56 w-full rounded-[18px] border border-white/8 object-contain"
          />
        )}

        {!result && (
          <div className="space-y-2.5">
            <Button
              full
              size="lg"
              loading={loading}
              icon={<Camera size={18} />}
              onClick={() => cameraRef.current?.click()}
            >
              Rechnung fotografieren
            </Button>
            <Button
              full
              variant="outline"
              disabled={loading}
              icon={<FolderOpen size={17} />}
              onClick={() => fileRef.current?.click()}
            >
              Bild vom Gerät wählen
            </Button>
          </div>
        )}

        {loading && (
          <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Sparkles size={15} className="text-brand-violet" />
              Die KI liest die Rechnung …
            </p>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <Card className="border-danger/30">
            <p className="text-[13.5px] leading-relaxed text-danger">{error}</p>
            {!hasApiKey() && (
              <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                Kostenlos einrichten – dauert eine Minute
              </Link>
            )}
          </Card>
        )}

        {result && !result.readable && (
          <Card className="border-warn/30">
            <div className="mb-1.5 flex items-center gap-2 text-warn">
              <AlertTriangle size={15} />
              <span className="text-[13px] font-semibold">Der Beleg war nicht lesbar</span>
            </div>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {result.note ?? 'Fotografiere die Rechnung gerade von oben, mit gutem Licht und ohne Schatten.'}
            </p>
          </Card>
        )}

        {result?.readable && (
          <>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                {result.workshop && <Badge tone="brand">{result.workshop}</Badge>}
                {result.date && <Badge>{formatDate(result.date)}</Badge>}
                {result.mileage != null && <Badge>{formatKm(result.mileage)}</Badge>}
              </div>
              {result.totalGrossEur != null && (
                <p className="tnum mt-3 text-[26px] leading-none font-bold">
                  {formatEur(result.totalGrossEur)}
                </p>
              )}
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">{result.summary}</p>
              {!complete && (
                <p className="mt-2.5 text-[12px] leading-relaxed text-warn">
                  Die erklärten Zeilen ergeben nicht die Endsumme – vermutlich ist ein Teil der
                  Rechnung nicht auf dem Bild. Fotografiere den Rest nach.
                </p>
              )}
            </Card>

            <section>
              <SectionTitle title="Position für Position" action={`${result.positions.length}`} />
              <div className="space-y-2.5">
                {result.positions.map((p, i) => {
                  const hotspotId = findHotspotId([p.partHint, p.label].filter(Boolean).join(' '), vehicle)
                  return (
                    <InvoicePositionCard
                      key={`${p.label}-${i}`}
                      position={p}
                      hotspot={hotspotId ? hotspotById(hotspotId, vehicle) : undefined}
                      job={jobs.find((j) => j.id === p.jobId)}
                      hourlyRate={hourlyRate}
                    />
                  )
                })}
              </div>
            </section>

            {result.questions && result.questions.length > 0 && (
              <Card>
                <div className="mb-2 flex items-center gap-2 text-brand-blue">
                  <HelpCircle size={16} />
                  <p className="text-[13px] font-semibold text-ink">Das kannst Du die Werkstatt fragen</p>
                </div>
                <ul className="space-y-1.5">
                  {result.questions.map((q) => (
                    <li key={q} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-blue" />
                      {q}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {result.followUp && result.followUp.length > 0 && (
              <Card>
                <p className="mb-2 text-[13px] font-semibold text-ink">Was daraus folgt</p>
                <ul className="space-y-1.5">
                  {result.followUp.map((f) => (
                    <li key={f} className="flex gap-2 text-[13.5px] leading-relaxed text-ink-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {saved ? (
              <Card className="border-ok/30 bg-ok/6">
                <div className="mb-1.5 flex items-center gap-2 text-ok">
                  <CheckCircle2 size={16} />
                  <span className="text-[13.5px] font-semibold">Übernommen</span>
                </div>
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  Der Beleg steht in Deinem Verlauf
                  {pickedIds.length > 0 && ` und ${pickedIds.length} Wartungsposition${pickedIds.length > 1 ? 'en sind' : ' ist'} aktualisiert`}
                  .
                </p>
                <Link to="/more" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                  Zum Verlauf
                </Link>
              </Card>
            ) : (
              <Card>
                <p className="text-[13px] font-semibold text-ink">In Deine Fahrzeugakte übernehmen?</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  Gespeichert wird ein Verlaufseintrag
                  {result.totalGrossEur != null && ` über ${formatEur(result.totalGrossEur)}`}
                  {result.date && ` vom ${formatDate(result.date)}`}.
                </p>

                {matching.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12.5px] font-semibold text-ink-faint">
                      Diese Wartungspositionen hat der Beleg erledigt – tippe an, was übernommen wird:
                    </p>
                    {matching.map((m) => {
                      const on = pickedIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setPickedIds((ids) =>
                              ids.includes(m.id) ? ids.filter((i) => i !== m.id) : [...ids, m.id],
                            )
                          }
                          className={cn(
                            'flex min-h-[44px] w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left transition',
                            on ? 'border-brand-blue/50 bg-brand-blue/10' : 'border-white/10 bg-white/4',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                              on ? 'border-brand-blue bg-brand-blue text-white' : 'border-white/25',
                            )}
                          >
                            {on && <Check size={13} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium">{m.label}</span>
                            <span className="tnum block text-[11.5px] text-ink-faint">
                              bisher {m.lastDoneAt ? formatDate(m.lastDoneAt) : 'ohne Datum'}
                              {m.lastDoneKm != null && ` · ${formatKm(m.lastDoneKm)}`}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <Button className="mt-3.5" full icon={<Check size={17} />} onClick={save}>
                  Übernehmen
                </Button>
              </Card>
            )}

            <Button variant="outline" full icon={<RotateCcw size={16} />} onClick={reset}>
              Nächste Rechnung
            </Button>

            <EstimateNote>
              Die Erklärungen stammen von der KI und beziehen sich auf das Foto – prüfe wichtige
              Angaben am Original. „Üblich für Dein Fahrzeug" ist eine gerechnete Schätzung aus
              Vorlagenpreisen und Deinem Stundensatz ({formatEur(hourlyRate)}/h, änderbar in den
              Einstellungen), kein Urteil über die Werkstatt. Das Bild verlässt Dein Gerät nur für
              diese eine Anfrage an den KI-Anbieter.
            </EstimateNote>
          </>
        )}
      </div>
    </Page>
  )
}

/** Tagesangabe der KI in ein volles ISO-Datum – Unlesbares wird zu heute */
function isoOf(day?: string) {
  if (!day) return todayIso()
  const d = new Date(day)
  return Number.isNaN(d.getTime()) ? todayIso() : d.toISOString()
}
