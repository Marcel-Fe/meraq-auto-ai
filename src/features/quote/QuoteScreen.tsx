import { useMemo, useState } from 'react'
import {
  Download,
  FileText,
  Minus,
  Plus,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Button,
  Card,
  EmptyState,
  EstimateNote,
  Field,
  Input,
  SectionTitle,
  Sheet,
  cn,
} from '../../components/ui'
import { HOURLY_RATES, repairJobsFor } from '../../data/parts'
import { formatDate, formatEur } from '../../lib/format'
import { useActiveVehicle, useAppStore } from '../../store/useAppStore'
import type { Quote } from '../../types'

const VAT_RATE = 0.19

export default function QuoteScreen() {
  const vehicle = useActiveVehicle()
  const {
    quotes,
    settings,
    createQuote,
    addQuoteItem,
    updateQuoteItem,
    removeQuoteItem,
    updateQuote,
    removeQuote,
  } = useAppStore()

  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState({ name: '', hours: '', parts: '' })

  const quote: Quote | undefined = useMemo(
    () => quotes.find((q) => q.vehicleId === vehicle?.id),
    [quotes, vehicle],
  )

  const jobs = useMemo(() => (vehicle ? repairJobsFor(vehicle) : []), [vehicle])
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) => j.name.toLowerCase().includes(q) || j.category.toLowerCase().includes(q))
  }, [jobs, query])

  const totals = useMemo(() => {
    if (!quote) return null
    const rate = quote.hourlyRateEur
    let laborHours = 0
    let partsMin = 0
    let partsMax = 0
    for (const i of quote.items) {
      laborHours += i.laborHours * i.quantity
      partsMin += i.partsMinEur * i.quantity
      partsMax += i.partsMaxEur * i.quantity
    }
    const labor = laborHours * rate
    const netMin = labor + partsMin
    const netMax = labor + partsMax
    return {
      laborHours,
      labor,
      partsMin,
      partsMax,
      netMin,
      netMax,
      vatMin: netMin * VAT_RATE,
      vatMax: netMax * VAT_RATE,
      grossMin: netMin * (1 + VAT_RATE),
      grossMax: netMax * (1 + VAT_RATE),
    }
  }, [quote])

  if (!vehicle) return null

  const ensureQuote = () => quote?.id ?? createQuote(vehicle.id, settings.hourlyRateEur)

  const addJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return
    const id = ensureQuote()
    addQuoteItem(id, {
      jobId: job.id,
      name: job.name,
      quantity: 1,
      laborHours: job.laborHours,
      partsMinEur: job.partsMinEur,
      partsMaxEur: job.partsMaxEur,
    })
    setAddOpen(false)
    setQuery('')
  }

  const addCustom = () => {
    if (!custom.name.trim()) return
    const id = ensureQuote()
    const parts = Number(custom.parts) || 0
    addQuoteItem(id, {
      name: custom.name.trim(),
      quantity: 1,
      laborHours: Number(custom.hours) || 0,
      partsMinEur: parts,
      partsMaxEur: parts,
    })
    setCustom({ name: '', hours: '', parts: '' })
    setCustomOpen(false)
    setAddOpen(false)
  }

  const exportText = () => {
    if (!quote || !totals) return
    const lines = [
      `KOSTENVORANSCHLAG (Schätzung)`,
      ``,
      `Fahrzeug: ${vehicle.make} ${vehicle.model}, ${vehicle.year}`,
      vehicle.vin ? `Fahrgestellnummer: ${vehicle.vin}` : '',
      `Kilometerstand: ${vehicle.mileage.toLocaleString('de-DE')} km`,
      `Datum: ${formatDate(quote.createdAt)}`,
      `Stundensatz: ${formatEur(quote.hourlyRateEur)}`,
      ``,
      `POSITIONEN`,
      ...quote.items.map(
        (i, n) =>
          `${n + 1}. ${i.name}${i.quantity > 1 ? ` (${i.quantity}×)` : ''}\n` +
          `   Arbeitszeit: ${(i.laborHours * i.quantity).toFixed(1)} h\n` +
          `   Ersatzteile: ${
            i.partsMinEur === i.partsMaxEur
              ? formatEur(i.partsMinEur * i.quantity)
              : `${formatEur(i.partsMinEur * i.quantity)} – ${formatEur(i.partsMaxEur * i.quantity)}`
          }`,
      ),
      ``,
      `SUMME`,
      `Arbeitszeit gesamt: ${totals.laborHours.toFixed(1)} h = ${formatEur(totals.labor)}`,
      `Ersatzteile: ${formatEur(totals.partsMin)} – ${formatEur(totals.partsMax)}`,
      `Netto: ${formatEur(totals.netMin)} – ${formatEur(totals.netMax)}`,
      `MwSt. 19 %: ${formatEur(totals.vatMin)} – ${formatEur(totals.vatMax)}`,
      `BRUTTO: ${formatEur(totals.grossMin)} – ${formatEur(totals.grossMax)}`,
      ``,
      `Hinweis: Diese Aufstellung ist eine Schätzung auf Basis üblicher Arbeitswerte und`,
      `Teilepreise. Sie ist kein verbindliches Angebot. Erstellt mit MERAQ AUTO AI.`,
    ].filter(Boolean)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kostenvoranschlag-${vehicle.make}-${vehicle.model}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Page>
      <PageHeader
        title="Kostenvoranschlag"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/repair-costs"
        right={
          <button
            type="button"
            aria-label="Position hinzufügen"
            onClick={() => setAddOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div className="anim-fade-up space-y-5">
        {!quote || quote.items.length === 0 ? (
          <EmptyState
            icon={<FileText size={26} />}
            title="Noch keine Positionen"
            text="Stelle zusammen, was gemacht werden soll – die App rechnet Arbeitszeit, Teile und Mehrwertsteuer zusammen wie eine Werkstatt."
            action={
              <Button icon={<Plus size={17} />} onClick={() => setAddOpen(true)}>
                Erste Position hinzufügen
              </Button>
            }
          />
        ) : (
          <>
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[12px] text-ink-faint">Stundensatz</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={quote.hourlyRateEur}
                    onChange={(e) =>
                      updateQuote(quote.id, { hourlyRateEur: Number(e.target.value) || 110 })
                    }
                    className="w-24 py-2 text-right"
                  />
                  <span className="text-[13px] text-ink-muted">€/h</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HOURLY_RATES.map((r) => (
                  <button
                    key={r.rate}
                    type="button"
                    onClick={() => updateQuote(quote.id, { hourlyRateEur: r.rate })}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                      quote.hourlyRateEur === r.rate
                        ? 'border-brand-blue/40 bg-brand-blue/15 text-brand-blue'
                        : 'border-white/10 text-ink-muted',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Card>

            <section>
              <SectionTitle title="Positionen" action={`${quote.items.length}`} />
              <div className="space-y-2.5">
                {quote.items.map((item, index) => (
                  <Card key={item.id}>
                    <div className="flex items-start gap-3">
                      <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/8 text-[11px] font-bold text-ink-muted">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-medium">{item.name}</p>
                        <p className="tnum mt-0.5 text-[11.5px] text-ink-faint">
                          {(item.laborHours * item.quantity).toFixed(1)} h ·{' '}
                          {item.partsMinEur === item.partsMaxEur
                            ? formatEur(item.partsMinEur * item.quantity)
                            : `${formatEur(item.partsMinEur * item.quantity)} – ${formatEur(item.partsMaxEur * item.quantity)}`}{' '}
                          Teile
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Position entfernen"
                        onClick={() => removeQuoteItem(quote.id, item.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint active:bg-white/8"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Weniger"
                          onClick={() =>
                            updateQuoteItem(quote.id, item.id, {
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white/6 active:bg-white/12"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="tnum w-6 text-center text-[14px] font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Mehr"
                          onClick={() =>
                            updateQuoteItem(quote.id, item.id, { quantity: item.quantity + 1 })
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white/6 active:bg-white/12"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="tnum text-[15px] font-bold">
                        {formatEur(
                          (item.laborHours * quote.hourlyRateEur + item.partsMaxEur) * item.quantity,
                        )}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
              <Button
                className="mt-3"
                variant="outline"
                full
                icon={<Plus size={17} />}
                onClick={() => setAddOpen(true)}
              >
                Weitere Position
              </Button>
            </section>

            {totals && (
              <section>
                <SectionTitle title="Summe" />
                <Card className="space-y-2.5">
                  <Line
                    label={`Arbeitszeit ${totals.laborHours.toFixed(1)} h × ${formatEur(quote.hourlyRateEur)}`}
                    value={formatEur(totals.labor)}
                  />
                  <Line
                    label="Ersatzteile"
                    value={
                      totals.partsMin === totals.partsMax
                        ? formatEur(totals.partsMin)
                        : `${formatEur(totals.partsMin)} – ${formatEur(totals.partsMax)}`
                    }
                  />
                  <Line
                    label="Netto"
                    value={`${formatEur(totals.netMin)} – ${formatEur(totals.netMax)}`}
                  />
                  <Line
                    label="MwSt. 19 %"
                    value={`${formatEur(totals.vatMin)} – ${formatEur(totals.vatMax)}`}
                  />
                  <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-3">
                    <span className="text-[15px] font-bold">Brutto</span>
                    <span className="tnum text-right text-[18px] font-bold">
                      {formatEur(totals.grossMin)}
                      <br />
                      <span className="text-[13px] font-medium text-ink-muted">
                        bis {formatEur(totals.grossMax)}
                      </span>
                    </span>
                  </div>
                </Card>
              </section>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" icon={<Download size={17} />} onClick={exportText}>
                Exportieren
              </Button>
              <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => removeQuote(quote.id)}>
                Verwerfen
              </Button>
            </div>

            <EstimateNote>
              Gerechnet wie in der Werkstatt: Arbeitszeit × Stundensatz + Ersatzteile + 19 % MwSt.
              Die Spanne kommt von der Teilequalität – unten Aftermarket, oben Originalteile. Das
              ist eine <strong className="text-ink">Schätzung zur Vorbereitung</strong>, kein
              verbindliches Angebot. Mit dem Export kannst Du die Aufstellung mit dem echten
              Kostenvoranschlag der Werkstatt vergleichen.
            </EstimateNote>
          </>
        )}
      </div>

      {/* Position hinzufügen */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Position hinzufügen">
        <div className="space-y-4">
          <div className="relative">
            <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Arbeit suchen…"
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            {searchResults.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => addJob(j.id)}
                className="glass flex w-full items-center gap-3 rounded-xl p-3 text-left"
              >
                <Wrench size={17} className="shrink-0 text-brand-teal" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{j.name}</span>
                  <span className="tnum block text-[11.5px] text-ink-faint">
                    {j.laborHours.toFixed(1)} h · {j.category}
                  </span>
                </span>
                <Plus size={17} className="shrink-0 text-brand-blue" />
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="py-3 text-center text-[13px] text-ink-faint">Keine passende Arbeit gefunden.</p>
            )}
          </div>

          <Button variant="outline" full onClick={() => setCustomOpen(true)}>
            Eigene Position eintragen
          </Button>
        </div>
      </Sheet>

      {/* Eigene Position */}
      <Sheet open={customOpen} onClose={() => setCustomOpen(false)} title="Eigene Position">
        <div className="space-y-4">
          <Field label="Bezeichnung">
            <Input
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
              placeholder="z. B. Radlager hinten links"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Arbeitszeit (h)">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={custom.hours}
                onChange={(e) => setCustom({ ...custom, hours: e.target.value })}
                placeholder="1,5"
              />
            </Field>
            <Field label="Teile (€)">
              <Input
                type="number"
                inputMode="numeric"
                value={custom.parts}
                onChange={(e) => setCustom({ ...custom, parts: e.target.value })}
                placeholder="120"
              />
            </Field>
          </div>
          <Button full size="lg" onClick={addCustom} disabled={!custom.name.trim()}>
            Hinzufügen
          </Button>
        </div>
      </Sheet>
    </Page>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="tnum shrink-0 text-[14px] font-medium">{value}</span>
    </div>
  )
}
