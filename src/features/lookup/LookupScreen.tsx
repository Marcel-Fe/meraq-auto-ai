import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeEuro,
  Car,
  CheckCircle2,
  Plus,
  Search,
  Sparkles,
  ThumbsUp,
  Wrench,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EstimateNote,
  Field,
  Input,
  SectionTitle,
  Segmented,
  Select,
  cn,
} from '../../components/ui'
import { VehicleImage, VehicleImageCredit } from '../../components/VehicleCard'
import { brandsFor } from '../../data/brands'
import { repairJobsFor } from '../../data/parts'
import { calculateCosts, calculateTax } from '../../lib/costs'
import { formatEur, formatEurCents, formatRange } from '../../lib/format'
import { valuate } from '../../lib/valuation'
import { vehicleProfile } from '../../lib/vehicleProfile'
import { askClaudeStructured, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_VEHICLE_FACTS, vehicleContext } from '../../lib/ai/prompts'
import { useAppStore } from '../../store/useAppStore'
import type { Condition, FuelType, Transmission, Vehicle, VehicleKind } from '../../types'

const KINDS: { value: VehicleKind; label: string }[] = [
  { value: 'car', label: 'Auto' },
  { value: 'motorcycle', label: 'Motorrad' },
  { value: 'van', label: 'Transporter' },
]

const FUELS: FuelType[] = ['Benzin', 'Diesel', 'Elektro', 'Hybrid', 'Plug-in-Hybrid', 'LPG', 'CNG']
const CONDITIONS: Condition[] = ['sehr gut', 'gut', 'befriedigend', 'reparaturbedürftig']

interface Facts {
  summary: string
  strengths: string[]
  weakspots: { title: string; detail: string; typicalKm?: string; costRange?: string }[]
  checkBeforeBuying: string[]
  runningCosts: string
  verdict: string
  certainty: 'gut bekannt' | 'teilweise bekannt' | 'kaum bekannt'
}

const FACTS_SCHEMA = {
  type: 'object' as const,
  properties: {
    summary: { type: 'string', description: 'Zwei bis drei Sätze: was für ein Fahrzeug das ist und für wen es passt.' },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Drei bis fünf konkrete Stärken dieser Baureihe, jeweils ein kurzer Satz.',
    },
    weakspots: {
      type: 'array',
      description: 'Die bekannten Schwachstellen, wichtigste zuerst. Höchstens sechs.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Kurzer Name des Problems' },
          detail: { type: 'string', description: 'Ein bis zwei Sätze: was passiert und woran man es merkt' },
          typicalKm: { type: 'string', description: 'Bei welchem Kilometerstand es typischerweise auftritt, z. B. "ab 120.000 km"' },
          costRange: { type: 'string', description: 'Grobe Reparaturkosten als Spanne, z. B. "600–1.400 €"' },
        },
        required: ['title', 'detail'],
      },
    },
    checkBeforeBuying: {
      type: 'array',
      items: { type: 'string' },
      description: 'Konkrete Prüfpunkte bei der Besichtigung – was teuer werden kann, wenn man es übersieht.',
    },
    runningCosts: { type: 'string', description: 'Zwei bis drei Sätze zu Unterhalt: Verbrauch, Verschleiß, Teileversorgung, Werkstattfreundlichkeit.' },
    verdict: { type: 'string', description: 'Ein klares Fazit in zwei Sätzen: kaufen oder Finger weg, und unter welcher Bedingung.' },
    certainty: {
      type: 'string',
      enum: ['gut bekannt', 'teilweise bekannt', 'kaum bekannt'],
      description: 'Wie gut Du diese konkrete Baureihe kennst. Ehrlich einschätzen.',
    },
  },
  required: ['summary', 'strengths', 'weakspots', 'checkBeforeBuying', 'runningCosts', 'verdict', 'certainty'],
}

export default function LookupScreen() {
  const addVehicle = useAppStore((s) => s.addVehicle)

  const [kind, setKind] = useState<VehicleKind>('car')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState(2019)
  const [mileage, setMileage] = useState(90_000)
  const [powerKw, setPowerKw] = useState(110)
  const [fuel, setFuel] = useState<FuelType>('Benzin')
  const [condition, setCondition] = useState<Condition>('gut')
  const [askingPrice, setAskingPrice] = useState<number | ''>('')

  const [facts, setFacts] = useState<Facts>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const brands = useMemo(() => brandsFor(kind), [kind])

  const draft: Vehicle | null = useMemo(() => {
    if (!make.trim() || !model.trim()) return null
    return {
      id: 'lookup',
      kind,
      make: make.trim(),
      model: model.trim(),
      year,
      mileage,
      mileageUpdatedAt: new Date().toISOString(),
      fuel,
      transmission: 'Schaltgetriebe' as Transmission,
      powerKw,
      condition,
      createdAt: new Date().toISOString(),
    }
  }, [kind, make, model, year, mileage, powerKw, fuel, condition])

  const valuation = useMemo(() => (draft ? valuate(draft) : null), [draft])
  const costs = useMemo(() => (draft ? calculateCosts(draft) : null), [draft])
  const profile = useMemo(() => (draft ? vehicleProfile(draft) : null), [draft])
  const topJobs = useMemo(() => {
    if (!draft) return []
    const rate = 110
    return repairJobsFor(draft)
      .filter((j) => ['inspection', 'brake-full-front', 'timing-belt', 'clutch', 'oil-service'].includes(j.id))
      .map((j) => ({
        name: j.name,
        min: j.partsMinEur + j.laborHours * rate,
        max: j.partsMaxEur + j.laborHours * rate,
      }))
  }, [draft])

  const priceVerdict = useMemo(() => {
    if (!valuation || typeof askingPrice !== 'number' || askingPrice <= 0) return null
    const diff = askingPrice - valuation.privateSale
    const pct = (diff / valuation.privateSale) * 100
    if (pct > 12) return { tone: 'danger' as const, label: 'deutlich über der Schätzung', diff, pct }
    if (pct > 4) return { tone: 'warn' as const, label: 'etwas über der Schätzung', diff, pct }
    if (pct < -12) return { tone: 'ok' as const, label: 'deutlich unter der Schätzung', diff, pct }
    return { tone: 'ok' as const, label: 'im erwarteten Rahmen', diff, pct }
  }, [valuation, askingPrice])

  const loadFacts = async () => {
    if (!draft) return
    if (!hasApiKey()) {
      setError('Für den Steckbrief brauchst Du einen API-Schlüssel (Einstellungen).')
      return
    }
    setLoading(true)
    setError('')
    setFacts(undefined)
    try {
      const res = await askClaudeStructured<Facts>({
        system: SYSTEM_VEHICLE_FACTS,
        context: vehicleContext(draft),
        messages: [
          {
            role: 'user',
            content:
              `Ich überlege, einen ${draft.make} ${draft.model} von ${draft.year} mit ` +
              `${draft.mileage.toLocaleString('de-DE')} km und ${draft.powerKw} kW (${draft.fuel}) zu kaufen. ` +
              `Was muss ich über diese Baureihe wissen?`,
          },
        ],
        toolName: 'fahrzeug_steckbrief',
        toolDescription: 'Trägt die Einschätzung zu dieser Baureihe strukturiert ein.',
        schema: FACTS_SCHEMA,
        maxTokens: 3000,
      })
      setFacts(res)
    } catch (err) {
      setError(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  const takeOver = () => {
    if (!draft) return
    const { id: _id, createdAt: _c, mileageUpdatedAt: _m, ...rest } = draft
    addVehicle(rest)
  }

  return (
    <Page>
      <PageHeader title="Fahrzeug nachschlagen" subtitle="ohne es anzulegen" backTo="/more" />

      <div className="anim-fade-up space-y-5">
        <Card>
          <div className="mb-3 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/15 text-brand-teal">
              <Search size={19} />
            </span>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Für den Gebrauchtwagenkauf: Daten eintippen und sofort sehen, was das Fahrzeug wert
              ist, was es im Unterhalt kostet und worauf Du bei der Besichtigung achten musst.
            </p>
          </div>

          <Segmented options={KINDS} value={kind} onChange={setKind} className="mb-4" />

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marke">
                <Input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="z. B. Volkswagen"
                  list="lookup-marken"
                  autoComplete="off"
                />
                <datalist id="lookup-marken">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Modell">
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="z. B. Passat" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Baujahr">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </Field>
              <Field label="Kilometerstand">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(Number(e.target.value))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Leistung (kW)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={powerKw}
                  onChange={(e) => setPowerKw(Number(e.target.value))}
                />
              </Field>
              <Field label="Kraftstoff">
                <Select value={fuel} onChange={(e) => setFuel(e.target.value as FuelType)}>
                  {FUELS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zustand">
                <Select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
                  {CONDITIONS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Geforderter Preis (€)" hint="optional">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value ? Number(e.target.value) : '')}
                  placeholder="z. B. 14900"
                />
              </Field>
            </div>
          </div>
        </Card>

        {!draft && (
          <p className="px-1 text-center text-[13px] text-ink-faint">
            Marke und Modell eintragen, dann rechnet die App sofort mit.
          </p>
        )}

        {draft && valuation && costs && profile && (
          <>
            <Card className="flex items-center gap-3">
              <VehicleImage vehicle={draft} className="h-20 w-[45%] shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {draft.make} {draft.model}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {draft.year} · {draft.fuel} · {Math.round(draft.powerKw * 1.36)} PS
                </p>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  {profile.sizeLabel} · {profile.brandLabel}
                </p>
              </div>
            </Card>
            <VehicleImageCredit vehicle={draft} />

            <section>
              <SectionTitle title="Was es wert ist" />
              <Card>
                <p className="text-[12px] text-ink-faint">Geschätzter Privatverkaufspreis</p>
                <p className="tnum mt-1 text-[32px] leading-none font-bold">
                  {formatEur(valuation.privateSale)}
                </p>
                <p className="tnum mt-2 text-[13px] text-ink-muted">
                  Spanne {formatEur(valuation.rangeMin)} – {formatEur(valuation.rangeMax)}
                </p>

                {priceVerdict && (
                  <div
                    className={cn(
                      'mt-4 rounded-xl px-3.5 py-3',
                      priceVerdict.tone === 'danger'
                        ? 'bg-danger/12'
                        : priceVerdict.tone === 'warn'
                          ? 'bg-warn/12'
                          : 'bg-ok/12',
                    )}
                  >
                    <p
                      className={cn(
                        'text-[13.5px] font-semibold',
                        priceVerdict.tone === 'danger'
                          ? 'text-danger'
                          : priceVerdict.tone === 'warn'
                            ? 'text-warn'
                            : 'text-ok',
                      )}
                    >
                      Geforderte {formatEur(Number(askingPrice))} liegen {priceVerdict.label}
                    </p>
                    <p className="tnum mt-1 text-[12.5px] text-ink-muted">
                      {priceVerdict.diff >= 0 ? '+' : ''}
                      {formatEur(priceVerdict.diff)} ({priceVerdict.pct >= 0 ? '+' : ''}
                      {priceVerdict.pct.toFixed(0)} %) gegenüber der Schätzung
                    </p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Mini label="Händler zahlt ca." value={formatEur(valuation.dealerPurchase)} />
                  <Mini label="Restwert in 3 Jahren" value={formatEur(valuation.residualIn3Years)} />
                </div>
              </Card>
            </section>

            <section>
              <SectionTitle title="Was es kostet" />
              <Card className="space-y-2.5">
                <Line label="Unterhalt pro Monat" value={formatEur(costs.totalMonth)} strong />
                <Line label="davon Wertverlust" value={`${formatEur(Math.round(costs.depreciation / 12))} / Monat`} />
                <Line
                  label={fuel === 'Elektro' ? 'Strom' : 'Kraftstoff'}
                  value={`${formatEur(Math.round(costs.fuel / 12))} / Monat`}
                />
                <Line label="Kfz-Steuer" value={
                  calculateTax(draft).missing ? 'Hubraum & CO₂ nötig' : `${formatEur(costs.tax)} / Jahr`
                } />
                <Line label="Kosten pro Kilometer" value={formatEurCents(costs.perKm)} />
              </Card>
            </section>

            {topJobs.length > 0 && (
              <section>
                <SectionTitle title="Typische Werkstattkosten" action="freie Werkstatt, 110 €/h" />
                <Card className="space-y-2.5">
                  {topJobs.map((j) => (
                    <Line key={j.name} label={j.name} value={formatRange(j.min, j.max)} />
                  ))}
                </Card>
              </section>
            )}

            <section>
              <SectionTitle title="Steckbrief der Baureihe" />
              {!facts ? (
                <Card>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-violet/15 text-brand-violet">
                      <Sparkles size={19} />
                    </span>
                    <p className="text-[12.5px] leading-relaxed text-ink-muted">
                      Die KI fasst zusammen, was diese Baureihe ausmacht: bekannte Schwachstellen mit
                      typischem Kilometerstand, was bei der Besichtigung zu prüfen ist und ein klares Fazit.
                    </p>
                  </div>
                  <Button
                    className="mt-3"
                    full
                    loading={loading}
                    icon={<Sparkles size={17} />}
                    onClick={loadFacts}
                  >
                    Steckbrief erstellen
                  </Button>
                  {error && (
                    <p className="mt-3 rounded-xl bg-danger/12 px-3 py-2.5 text-[12.5px] text-danger">
                      {error}
                      {!hasApiKey() && (
                        <Link to="/settings" className="mt-1 block font-medium text-brand-blue">
                          API-Schlüssel eintragen
                        </Link>
                      )}
                    </p>
                  )}
                </Card>
              ) : (
                <div className="space-y-3">
                  <Card>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">Einschätzung</span>
                      <Badge
                        tone={
                          facts.certainty === 'gut bekannt'
                            ? 'ok'
                            : facts.certainty === 'teilweise bekannt'
                              ? 'warn'
                              : 'danger'
                        }
                      >
                        {facts.certainty}
                      </Badge>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-ink-muted">{facts.summary}</p>
                  </Card>

                  {facts.weakspots.length > 0 && (
                    <Card>
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-warn" />
                        <span className="text-[13px] font-semibold">Bekannte Schwachstellen</span>
                      </div>
                      <div className="space-y-3">
                        {facts.weakspots.map((w) => (
                          <div key={w.title} className="border-l-2 border-warn/40 pl-3">
                            <p className="text-[13.5px] font-medium">{w.title}</p>
                            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{w.detail}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {w.typicalKm && <Badge>{w.typicalKm}</Badge>}
                              {w.costRange && <Badge tone="warn">{w.costRange}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {facts.checkBeforeBuying.length > 0 && (
                    <Card>
                      <div className="mb-2.5 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-brand-teal" />
                        <span className="text-[13px] font-semibold">Bei der Besichtigung prüfen</span>
                      </div>
                      <ul className="space-y-1.5">
                        {facts.checkBeforeBuying.map((c) => (
                          <li key={c} className="flex gap-2 text-[13px] text-ink-muted">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {facts.strengths.length > 0 && (
                    <Card>
                      <div className="mb-2.5 flex items-center gap-2">
                        <ThumbsUp size={16} className="text-ok" />
                        <span className="text-[13px] font-semibold">Stärken</span>
                      </div>
                      <ul className="space-y-1.5">
                        {facts.strengths.map((s) => (
                          <li key={s} className="flex gap-2 text-[13px] text-ink-muted">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ok" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  <Card>
                    <div className="mb-2 flex items-center gap-2">
                      <Wrench size={16} className="text-brand-blue" />
                      <span className="text-[13px] font-semibold">Unterhalt</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-ink-muted">{facts.runningCosts}</p>
                  </Card>

                  <Card className="border-brand-blue/30">
                    <div className="mb-2 flex items-center gap-2">
                      <BadgeEuro size={16} className="text-brand-blue" />
                      <span className="text-[13px] font-semibold">Fazit</span>
                    </div>
                    <p className="text-[13.5px] leading-relaxed text-ink">{facts.verdict}</p>
                  </Card>
                </div>
              )}
            </section>

            <Button variant="outline" full icon={<Plus size={17} />} onClick={takeOver}>
              Als mein Fahrzeug übernehmen
            </Button>

            <EstimateNote>
              Alle Zahlen sind Schätzungen aus den offengelegten Formeln der App – der Steckbrief
              kommt aus dem Modellwissen der KI und kann bei seltenen Baureihen ungenau sein. Nutze
              beides als Vorbereitung, nicht als Ersatz für eine Untersuchung. Vor dem Kauf lohnt
              sich immer ein Gebrauchtwagen-Check bei einer Prüforganisation (rund 100–150 €).
            </EstimateNote>
          </>
        )}

        {!draft && (
          <Card>
            <div className="flex items-start gap-3">
              <Car size={19} className="mt-0.5 shrink-0 text-ink-faint" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                Diese Seite speichert nichts. Willst Du das Fahrzeug behalten, kannst Du es am Ende
                mit einem Tipp als Dein Fahrzeug übernehmen.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Page>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-bold">{value}</p>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[13.5px]', strong ? 'font-semibold text-ink' : 'text-ink-muted')}>
        {label}
      </span>
      <span className={cn('tnum shrink-0', strong ? 'text-[16px] font-bold' : 'text-[14px] font-medium')}>
        {value}
      </span>
    </div>
  )
}
