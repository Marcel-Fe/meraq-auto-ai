import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Scale } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EstimateNote,
  SectionTitle,
  cn,
} from '../../components/ui'
import { VehicleImage, VehicleImageCredit } from '../../components/VehicleCard'
import { useAllActivities, useAppStore } from '../../store/useAppStore'
import { compareMetrics, compareVehicles, type MetricFormat } from '../../lib/compare'
import { formatEur, formatEurCents, formatKm } from '../../lib/format'
import type { Vehicle } from '../../types'

/** Mehr als drei Spalten passen bei 390 px Breite nicht mehr lesbar nebeneinander */
const MAX_COMPARED = 3

export default function CompareScreen() {
  const vehicles = useAppStore((s) => s.vehicles)
  const activeVehicleId = useAppStore((s) => s.activeVehicleId)
  const activities = useAllActivities()

  const [picked, setPicked] = useState<string[]>(() => {
    const first = activeVehicleId ?? vehicles[0]?.id
    const rest = vehicles.map((v) => v.id).filter((id) => id !== first)
    return [first, ...rest].filter((id): id is string => !!id).slice(0, 2)
  })

  // Ein Fahrzeug kann zwischenzeitlich gelöscht worden sein – dann still auffüllen,
  // statt mit einer leeren Spalte dazustehen.
  const selected = useMemo(() => {
    const list = picked
      .map((id) => vehicles.find((v) => v.id === id))
      .filter((v): v is Vehicle => !!v)
    if (list.length >= 2) return list
    const fill = vehicles.filter((v) => !list.some((s) => s.id === v.id))
    return [...list, ...fill].slice(0, 2)
  }, [picked, vehicles])

  const entries = useMemo(() => compareVehicles(selected, activities), [selected, activities])
  const metrics = useMemo(() => compareMetrics(entries), [entries])

  if (vehicles.length < 2) {
    return (
      <Page>
        <PageHeader title="Fahrzeuge vergleichen" backTo="/more" />
        <Card>
          <EmptyState
            icon={<Scale size={24} />}
            title="Zum Vergleichen fehlt ein zweites Fahrzeug"
            text="Lege ein weiteres Fahrzeug an – zum Beispiel eines, über dessen Kauf Du nachdenkst. Danach stellt Dir dieser Bereich Kosten, Wertverlust und Marktwert nebeneinander."
            action={
              <Link to="/vehicle/new">
                <Button icon={<Plus size={17} />}>Fahrzeug anlegen</Button>
              </Link>
            }
          />
        </Card>
      </Page>
    )
  }

  const toggle = (id: string) => {
    const ids = selected.map((v) => v.id)
    if (ids.includes(id)) {
      if (ids.length > 2) setPicked(ids.filter((x) => x !== id))
    } else if (ids.length < MAX_COMPARED) {
      setPicked([...ids, id])
    }
  }

  const columns = { gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))` }
  const dense = selected.length > 2

  const monthly = entries.map((e) => e.costs.totalMonth)
  const cheapest = monthly.indexOf(Math.min(...monthly))
  const priciest = monthly.indexOf(Math.max(...monthly))
  const monthlyDiff = monthly[priciest] - monthly[cheapest]

  return (
    <Page>
      <PageHeader
        title="Fahrzeuge vergleichen"
        subtitle={`${selected.length} von ${vehicles.length} Fahrzeugen`}
        backTo="/more"
      />

      <div className="anim-fade-up space-y-6">
        <section>
          <SectionTitle title="Welche Fahrzeuge?" action={`max. ${MAX_COMPARED}`} />
          <div className="flex flex-wrap gap-2">
            {vehicles.map((v) => {
              const on = selected.some((s) => s.id === v.id)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => toggle(v.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[44px] max-w-full items-center rounded-[14px] border px-3.5 text-[13px] font-medium transition active:scale-[.97]',
                    on
                      ? 'border-brand-blue/40 bg-brand-blue/15 text-brand-blue'
                      : 'border-white/10 bg-white/5 text-ink-muted',
                  )}
                >
                  <span className="truncate">
                    {v.make} {v.model}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <Card>
          <div className="grid gap-2.5" style={columns}>
            {selected.map((v) => (
              <div key={v.id} className="min-w-0 text-center">
                <VehicleImage vehicle={v} className="mx-auto h-12 w-full" />
                <p className={cn('mt-1.5 truncate font-semibold', dense ? 'text-[12px]' : 'text-[13.5px]')}>
                  {v.make}
                </p>
                <p className={cn('truncate text-ink-muted', dense ? 'text-[11px]' : 'text-[12px]')}>
                  {v.model}
                </p>
                <p className="tnum truncate text-[11px] text-ink-faint">
                  {v.year} · {v.fuel}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {monthlyDiff > 0 && (
          <Card className="border-ok/25">
            <p className="text-[12px] text-ink-faint">Unterm Strich</p>
            <p className="mt-1 text-[14px] leading-relaxed">
              <span className="font-semibold">
                {selected[cheapest].make} {selected[cheapest].model}
              </span>{' '}
              kostet Dich{' '}
              <span className="tnum font-semibold text-ok">{formatEur(monthlyDiff)}</span> im Monat
              weniger als{' '}
              <span className="font-semibold">
                {selected[priciest].make} {selected[priciest].model}
              </span>{' '}
              – das sind{' '}
              <span className="tnum font-semibold">{formatEur(monthlyDiff * 12)}</span> im Jahr.
            </p>
          </Card>
        )}

        <section>
          <SectionTitle title="Kennzahlen" />
          <Card className="space-y-4">
            {metrics.map((m) => (
              <div key={m.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-medium">{m.label}</span>
                  {m.bestIndex != null && (
                    <Badge tone="ok" className="shrink-0">
                      günstiger
                    </Badge>
                  )}
                </div>
                {m.hint && <p className="mt-0.5 text-[11.5px] text-ink-faint">{m.hint}</p>}
                <div className="mt-1.5 grid gap-1.5" style={columns}>
                  {m.values.map((value, i) => (
                    <span
                      key={selected[i].id}
                      className={cn(
                        'tnum min-w-0 truncate rounded-lg px-1.5 py-1.5 text-center font-semibold',
                        dense ? 'text-[12px]' : 'text-[13.5px]',
                        m.bestIndex === i
                          ? 'bg-ok/12 text-ok'
                          : value == null
                            ? 'bg-white/4 text-ink-faint'
                            : 'bg-white/4 text-ink',
                      )}
                    >
                      {formatMetric(value, m.format)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle title="Woher die Zahlen kommen" />
          <Card className="space-y-2.5">
            {entries.map((e) => (
              <div key={e.vehicle.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">
                    {e.vehicle.make} {e.vehicle.model}
                  </span>
                  <span className="block text-[11.5px] text-ink-faint">
                    {formatKm(e.vehicle.mileage)} · {e.costs.fuelUnit === 'kWh' ? 'Strom' : 'Kraftstoff'}{' '}
                    {formatEurCents(e.costs.fuelPricePerUnit)}/{e.costs.fuelUnit}
                  </span>
                </span>
                <Badge tone={e.costs.maintenanceFromRecords ? 'ok' : 'neutral'} className="shrink-0">
                  {e.costs.maintenanceFromRecords ? 'Belege' : 'geschätzt'}
                </Badge>
              </div>
            ))}
            {entries.some((e) => e.taxMissing) && (
              <p className="border-t border-white/8 pt-2.5 text-[12px] leading-relaxed text-warn">
                Bei mindestens einem Fahrzeug fehlen Hubraum oder CO₂-Wert. Die Kfz-Steuer bleibt
                dort offen und fehlt in der Summe – trage die Werte unter „Was kostet mich das
                Auto?" nach.
              </p>
            )}
          </Card>
        </section>

        {selected.map((v) => (
          <VehicleImageCredit key={v.id} vehicle={v} />
        ))}

        <EstimateNote>
          Verglichen werden gerechnete Werte, keine Marktdaten. Die Kfz-Steuer folgt dem Gesetz und
          ist genau, sobald Hubraum und CO₂-Wert stimmen. Wertverlust, Versicherung und die
          geschätzte Wartung sind Näherungen – ein Fahrzeug mit erfassten Rechnungen ist deshalb
          nicht direkt mit einem geschätzten vergleichbar. Kraftstoff- und Strompreise sind
          Mittelwerte für Deutschland (Stand 2026).
        </EstimateNote>
      </div>
    </Page>
  )
}

function formatMetric(value: number | null, format: MetricFormat) {
  if (value == null) return '—'
  if (format === 'eurCents') return formatEurCents(value)
  if (format === 'km') return formatKm(value)
  return formatEur(value)
}
