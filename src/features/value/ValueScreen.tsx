import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Calculator, Info, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Card, EstimateNote, SectionTitle, Segmented, cn } from '../../components/ui'
import {
  useActiveVehicle,
  useAppStore,
  useVehicleActivities,
  useVehicleDiagnoses,
  useVehicleDocuments,
  useVehicleMaintenance,
} from '../../store/useAppStore'
import { repairJobsFor } from '../../data/parts'
import { valuate, valueHistory } from '../../lib/valuation'
import { sellingChecklist, sellingFloor } from '../../lib/sellingPrice'
import MarketOpinionSection from './MarketOpinion'
import SellingCheck from './SellingCheck'
import { formatEur, formatMonth, formatNumber } from '../../lib/format'

const RANGES = [
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '1J' },
  { value: '24', label: '2J' },
] as const

export default function ValueScreen() {
  const vehicle = useActiveVehicle()
  const maintenance = useVehicleMaintenance()
  const activities = useVehicleActivities()
  const diagnoses = useVehicleDiagnoses()
  const documents = useVehicleDocuments()
  const hourlyRateEur = useAppStore((s) => s.settings.hourlyRateEur)
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('12')

  const valuation = useMemo(() => (vehicle ? valuate(vehicle) : null), [vehicle])
  const history = useMemo(
    () => (vehicle ? valueHistory(vehicle, Number(range)) : []),
    [vehicle, range],
  )

  // Der wirkliche Zustand: überfällige Wartung, offene Fehlercodes, HU, Belege.
  // Alles davon liegt schon im Store – die Bewertung selbst bleibt unberührt.
  const floor = useMemo(
    () =>
      vehicle && valuation
        ? sellingFloor(vehicle, {
            maintenance,
            activities,
            diagnoses,
            documents,
            jobs: repairJobsFor(vehicle),
            hourlyRateEur,
            valuation,
          })
        : null,
    [vehicle, valuation, maintenance, activities, diagnoses, documents, hourlyRateEur],
  )

  const checklist = useMemo(
    () =>
      vehicle
        ? sellingChecklist(vehicle, { maintenance, activities, diagnoses, documents })
        : [],
    [vehicle, maintenance, activities, diagnoses, documents],
  )

  if (!vehicle || !valuation || !floor) return null

  const first = history[0]?.value ?? 0
  const last = history[history.length - 1]?.value ?? 0
  const delta = last - first
  const deltaPct = first ? (delta / first) * 100 : 0

  const prices = [
    { label: 'Händler-Ankauf', value: valuation.dealerPurchase, note: 'was Du beim Verkauf an einen Händler bekommst' },
    { label: 'Privatverkauf', value: valuation.privateSale, note: 'realistischer Preis von privat an privat', highlight: true },
    { label: 'Händler-Verkauf', value: valuation.dealerSale, note: 'was ein Händler für so ein Fahrzeug verlangt' },
    { label: 'Export', value: valuation.exportValue, note: 'Verkauf ins Ausland, meist der niedrigste Preis' },
  ]

  const chartData = history.map((h) => ({ ...h, label: formatMonth(h.date) }))

  return (
    <Page>
      <PageHeader
        title="Marktwert"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/"
      />

      <div className="anim-fade-up space-y-6">
        <Card>
          <p className="text-[12px] text-ink-faint">Geschätzter Wert (Privatverkauf)</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="tnum text-[36px] leading-none font-bold">{formatEur(valuation.privateSale)}</p>
            <Badge tone={delta >= 0 ? 'ok' : 'danger'}>
              {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta >= 0 ? '+' : ''}
              {deltaPct.toFixed(1)} %
            </Badge>
          </div>
          <p className="tnum mt-2 text-[13px] text-ink-muted">
            Spanne {formatEur(valuation.rangeMin)} – {formatEur(valuation.rangeMax)}
          </p>

          <Segmented className="mt-4" options={RANGES} value={range} onChange={setRange} />

          <div className="mt-4 h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="value-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  domain={['dataMin - 500', 'dataMax + 500']}
                  // eine Nachkommastelle, sonst stehen bei enger Spanne zwei gleiche Werte übereinander
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1).replace('.', ',')}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0E1424',
                    border: '1px solid rgba(255,255,255,.12)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(v) => [formatEur(Number(v)), 'Wert']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3B82F6"
                  strokeWidth={2.2}
                  fill="url(#value-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <section>
          <SectionTitle title="Je nach Verkaufsweg" />
          <div className="grid grid-cols-2 gap-2.5">
            {prices.map((p) => (
              <div
                key={p.label}
                className={cn(
                  'rounded-[16px] p-3.5',
                  p.highlight ? 'brand-gradient text-white' : 'glass',
                )}
              >
                <p className={cn('text-[11.5px]', p.highlight ? 'text-white/80' : 'text-ink-faint')}>
                  {p.label}
                </p>
                <p className="tnum mt-1 text-[19px] font-bold">{formatEur(p.value)}</p>
                <p
                  className={cn(
                    'mt-1 text-[10.5px] leading-snug',
                    p.highlight ? 'text-white/75' : 'text-ink-faint',
                  )}
                >
                  {p.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Deine Preisuntergrenze" />
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ok/15 text-ok">
                <ShieldCheck size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-ink-faint">Darunter gibst Du es unter Wert weg</p>
                <p className="tnum mt-0.5 text-[30px] leading-none font-bold text-ok">
                  {formatEur(floor.floor)}
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-white/4 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-muted">
              „{floor.sentence}“
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-[16px] bg-white/4 p-3">
                <p className="text-[11.5px] text-ink-faint">So inserieren</p>
                <p className="tnum mt-1 text-[18px] font-bold">{formatEur(floor.askingPrice)}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">mit Luft zum Verhandeln</p>
              </div>
              <div className="rounded-[16px] bg-white/4 p-3">
                <p className="text-[11.5px] text-ink-faint">Realistisch privat</p>
                <p className="tnum mt-1 text-[18px] font-bold">{formatEur(floor.adjustedPrivate)}</p>
                <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
                  {floor.adjustmentsTotal === 0
                    ? 'ohne Zu- und Abschläge'
                    : 'nach den Zu- und Abschlägen unten'}
                </p>
              </div>
            </div>

            <p className="tnum mt-3 border-t border-white/8 pt-3 text-[11.5px] leading-relaxed text-ink-faint">
              {floor.formula}
            </p>
          </Card>
        </section>

        {floor.adjustments.length > 0 && (
          <section>
            <SectionTitle title="Was den Preis wirklich bewegt" />
            <Card>
              <div className="space-y-3.5">
                {floor.adjustments.map((a) => (
                  <div key={a.id} className="border-b border-white/6 pb-3.5 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-medium">{a.label}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                          {a.reason}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'tnum shrink-0 text-[14px] font-semibold',
                          a.amountEur >= 0 ? 'text-ok' : 'text-warn',
                        )}
                      >
                        {a.amountEur >= 0 ? '+' : '−'} {formatEur(Math.abs(a.amountEur))}
                      </span>
                    </div>
                    <p className="tnum mt-1.5 text-[11px] leading-snug text-ink-faint">{a.formula}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
                <span className="text-[14px] font-semibold">Zusammen</span>
                <span
                  className={cn(
                    'tnum text-[16px] font-bold',
                    floor.adjustmentsTotal >= 0 ? 'text-ok' : 'text-warn',
                  )}
                >
                  {floor.adjustmentsTotal >= 0 ? '+' : '−'}{' '}
                  {formatEur(Math.abs(floor.adjustmentsTotal))}
                </span>
              </div>

              {floor.capped && (
                <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
                  Die Summe ist begrenzt: Auch mit vielen offenen Punkten bleibt ein Fahrzeug
                  mindestens 45 % seines Papierwerts wert. Wer alles davon abzieht, rechnet sich
                  ein fahrbereites Auto schön.
                </p>
              )}
            </Card>

            <EstimateNote>
              Diese Posten kommen aus Deinen eigenen Daten – Wartungsplan, Fehlerspeicher,
              HU-Termin und Belegen im Verlauf. Was keine passende Werkstattposition hat, taucht
              hier bewusst nicht auf: eine geratene Zahl wäre schlechter als keine.
            </EstimateNote>
          </section>
        )}

        <SellingCheck points={checklist} floor={floor.floor} />

        <section>
          <SectionTitle title="Restwert-Prognose" />
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] text-ink-muted">In 3 Jahren</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">
                bei {formatNumber(15000)} km Fahrleistung pro Jahr
              </p>
            </div>
            <p className="tnum text-[22px] font-bold">{formatEur(valuation.residualIn3Years)}</p>
          </Card>
        </section>

        <section>
          <SectionTitle title="Zweite Meinung" />
          <MarketOpinionSection vehicle={vehicle} ownPrivateSale={valuation.privateSale} />
        </section>

        <section>
          <SectionTitle title="So kommt der Wert zustande" />
          <Card>
            <div className="mb-3 flex items-center justify-between border-b border-white/8 pb-3">
              <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Calculator size={15} />
                Neupreis (Basis)
              </span>
              <span className="tnum text-[14px] font-semibold">{formatEur(valuation.basePriceNew)}</span>
            </div>

            <div className="space-y-3">
              {valuation.factors.map((f) => (
                <div key={f.label} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">{f.label}</span>
                    <span className="block text-[11.5px] text-ink-faint">{f.detail}</span>
                  </span>
                  <span
                    className={cn(
                      'tnum shrink-0 text-[14px] font-semibold',
                      f.factor >= 1 ? 'text-ok' : 'text-warn',
                    )}
                  >
                    × {f.factor.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
              <span className="text-[14px] font-semibold">Ergebnis</span>
              <span className="tnum text-[17px] font-bold">{formatEur(valuation.privateSale)}</span>
            </div>
          </Card>

          <EstimateNote>
            <span className="flex items-start gap-2">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>
                Diese Zahl stammt aus der oben gezeigten Rechnung, nicht aus einer Marktdatenbank.
                Echte Bewertungen (DAT, Schwacke) berücksichtigen Ausstattung, Region und Nachfrage –
                dafür braucht es kostenpflichtige Daten. Für die Verhandlung ist trotzdem die
                Untergrenze weiter oben die belastbare Größe: Sie steht auf dem, was ein Händler
                heute zahlen würde. Genauer wird alles, wenn Du in den Fahrzeugdaten den echten
                Neupreis und den ehrlichen Zustand einträgst.
              </span>
            </span>
          </EstimateNote>
        </section>
      </div>
    </Page>
  )
}
