import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, FileSpreadsheet, MapPin, Search, Wrench } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Button, Card, EstimateNote, Input, SectionTitle, Segmented, Sheet } from '../../components/ui'
import { HOURLY_RATES, repairJobsFor } from '../../data/parts'
import { formatEur, formatRange } from '../../lib/format'
import { vehicleProfile } from '../../lib/vehicleProfile'
import { useActiveVehicle, useAppStore } from '../../store/useAppStore'
import type { RepairJob } from '../../types'

export default function RepairCostScreen() {
  const vehicle = useActiveVehicle()
  const { settings, updateSettings } = useAppStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<RepairJob | null>(null)

  const rate = settings.hourlyRateEur

  // Positionen und Preise hängen vom Fahrzeug ab – ein Lkw-Bremsenwechsel
  // kostet ein Vielfaches eines Kleinwagens, ein E-Auto hat keine Zündkerzen
  const jobs = useMemo(() => (vehicle ? repairJobsFor(vehicle) : []), [vehicle])
  const profile = useMemo(() => (vehicle ? vehicleProfile(vehicle) : null), [vehicle])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter(
      (j) => j.name.toLowerCase().includes(q) || j.category.toLowerCase().includes(q),
    )
  }, [jobs, query])

  if (!vehicle) return null

  const calc = (job: RepairJob) => {
    const labor = job.laborHours * rate
    return {
      labor,
      min: job.partsMinEur + labor,
      max: job.partsMaxEur + labor,
    }
  }

  return (
    <Page>
      <PageHeader
        title="Reparaturkosten"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/"
      />

      <div className="anim-fade-up space-y-5">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Calculator size={17} className="text-brand-teal" />
            <p className="text-[14px] font-semibold">Stundensatz der Werkstatt</p>
          </div>
          <Segmented
            options={HOURLY_RATES.map((r) => ({ value: String(r.rate), label: r.label }))}
            value={String(
              HOURLY_RATES.find((r) => r.rate === rate)?.rate ?? HOURLY_RATES[0].rate,
            )}
            onChange={(v) => updateSettings({ hourlyRateEur: Number(v) })}
          />
          <div className="mt-3 flex items-center gap-3">
            <Input
              type="number"
              inputMode="numeric"
              value={rate}
              onChange={(e) => updateSettings({ hourlyRateEur: Number(e.target.value) || 110 })}
              className="flex-1"
            />
            <span className="text-[13px] text-ink-muted">€ / Stunde</span>
          </div>
        </Card>

        <div className="relative">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reparatur suchen…"
            className="pl-10"
          />
        </div>

        <section>
          <SectionTitle title="Kalkulation" action={`${list.length} Positionen`} />
          <div className="space-y-2.5">
            {list.map((job) => {
              const c = calc(job)
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelected(job)}
                  className="glass w-full rounded-[18px] p-3.5 text-left transition active:scale-[.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium">{job.name}</span>
                      <span className="tnum mt-0.5 block text-[11.5px] text-ink-faint">
                        {job.category} · {job.laborHours.toFixed(1)} h Arbeitszeit
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-right text-[15px] font-bold whitespace-nowrap">
                      {formatRange(c.min, c.max)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <EstimateNote>
          Gerechnet wird: Ersatzteil-Spanne + (Arbeitszeit × Stundensatz).
          {profile && (
            <>
              {' '}Beides ist auf Dein Fahrzeug umgerechnet ({profile.sizeLabel}, {profile.brandLabel}):
              Teile ×{profile.partsFactor.toFixed(2)}, Arbeitszeit ×{profile.laborFactor.toFixed(2)}.
            </>
          )}{' '}
          Die Arbeitswerte sind übliche Richtwerte, keine herstellerspezifischen Vorgabezeiten. Ein
          echtes Angebot bekommst Du nur von einer Werkstatt – hol Dir für größere Arbeiten immer
          zwei Kostenvoranschläge.
        </EstimateNote>

        <div className="grid gap-2.5">
          <Link to="/quote">
            <Button full icon={<FileSpreadsheet size={17} />}>
              Kostenvoranschlag zusammenstellen
            </Button>
          </Link>
          <Link to="/workshops">
            <Button variant="outline" full icon={<MapPin size={17} />}>
              Werkstätten in der Nähe
            </Button>
          </Link>
        </div>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-4">
            {(() => {
              const c = calc(selected)
              return (
                <>
                  <Card>
                    <p className="text-[12px] text-ink-faint">Geschätzte Gesamtkosten</p>
                    <p className="tnum mt-1 text-[28px] leading-none font-bold">
                      {formatRange(c.min, c.max)}
                    </p>
                  </Card>

                  <Card className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] text-ink-muted">Ersatzteile</span>
                      <span className="tnum text-[14px] font-medium">
                        {selected.partsMaxEur > 0
                          ? formatRange(selected.partsMinEur, selected.partsMaxEur)
                          : 'keine'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13.5px] text-ink-muted">
                        Arbeitszeit ({selected.laborHours.toFixed(1)} h × {formatEur(rate)})
                      </span>
                      <span className="tnum text-[14px] font-medium">{formatEur(c.labor)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
                      <span className="text-[14px] font-semibold">Gesamt</span>
                      <span className="tnum text-[16px] font-bold">{formatRange(c.min, c.max)}</span>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start gap-2.5">
                      <Wrench size={17} className="mt-0.5 shrink-0 text-brand-teal" />
                      <p className="text-[12.5px] leading-relaxed text-ink-muted">
                        Die Spanne kommt von der Teilequalität: der untere Wert entspricht guten
                        Aftermarket-Teilen, der obere Originalteilen vom Hersteller. Bei
                        sicherheitsrelevanten Bauteilen lohnt sich der Aufpreis.
                        {selected.note && (
                          <>
                            <br />
                            <br />
                            {selected.note}
                          </>
                        )}
                      </p>
                    </div>
                  </Card>

                  <Link to="/workshops">
                    <Button full icon={<MapPin size={17} />}>
                      Werkstätten vergleichen
                    </Button>
                  </Link>
                </>
              )
            })()}
          </div>
        )}
      </Sheet>
    </Page>
  )
}
