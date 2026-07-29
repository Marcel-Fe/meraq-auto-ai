import { useMemo, useState } from 'react'
import {
  BatteryCharging,
  Check,
  Circle,
  Droplet,
  Fan,
  Filter,
  Gauge,
  Link2,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Timer,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, ProgressBar, SectionTitle, Sheet, cn } from '../../components/ui'
import { useActiveVehicle, useAppStore, useVehicleMaintenance } from '../../store/useAppStore'
import { maintenanceStatus, sortByUrgency, type MaintenanceStatus } from '../../lib/maintenance'
import { formatDate, formatKm } from '../../lib/format'
import type { MaintenanceKind } from '../../types'

const ICONS: Record<MaintenanceKind, typeof Wrench> = {
  oil: Droplet,
  inspection: Wrench,
  'brake-fluid': ShieldCheck,
  'air-filter': Filter,
  'cabin-filter': Fan,
  'spark-plugs': Zap,
  'timing-belt': Timer,
  'ac-service': Snowflake,
  tires: Circle,
  battery: Zap,
  hu: ShieldCheck,
  chain: Link2,
  'valve-clearance': Gauge,
  coolant: Thermometer,
  dpf: Wind,
  'hv-battery': BatteryCharging,
}

const STATE_TONE = {
  ok: 'ok',
  soon: 'ok',
  due: 'warn',
  overdue: 'danger',
} as const

const STATE_LABEL = {
  ok: 'in Ordnung',
  soon: 'bald fällig',
  due: 'fällig',
  overdue: 'überfällig',
} as const

export default function MaintenanceScreen() {
  const vehicle = useActiveVehicle()
  const items = useVehicleMaintenance()
  const completeMaintenance = useAppStore((s) => s.completeMaintenance)
  const [selected, setSelected] = useState<MaintenanceStatus | null>(null)

  const list = useMemo(() => {
    if (!vehicle) return []
    return sortByUrgency(items.map((m) => maintenanceStatus(m, vehicle)))
  }, [items, vehicle])

  if (!vehicle) return null

  const overdue = list.filter((s) => s.state === 'overdue').length
  const due = list.filter((s) => s.state === 'due' || s.state === 'soon').length

  return (
    <Page>
      <PageHeader title="Wartung" subtitle={`${vehicle.make} ${vehicle.model}`} backTo="/" />

      <div className="anim-fade-up space-y-6">
        <div className="grid grid-cols-3 gap-2.5">
          <Card className="text-center">
            <p className="tnum text-[24px] font-bold text-danger">{overdue}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">überfällig</p>
          </Card>
          <Card className="text-center">
            <p className="tnum text-[24px] font-bold text-warn">{due}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">demnächst</p>
          </Card>
          <Card className="text-center">
            <p className="tnum text-[24px] font-bold text-ok">
              {list.length - overdue - due}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">in Ordnung</p>
          </Card>
        </div>

        <Card className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/6 text-brand-teal">
            <Gauge size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Kilometerstand</span>
            <span className="tnum block text-[12px] text-ink-muted">
              {formatKm(vehicle.mileage)} · Stand {formatDate(vehicle.mileageUpdatedAt)}
            </span>
          </span>
        </Card>

        <section>
          <SectionTitle title="Wartungsplan" action={`${list.length} Positionen`} />
          <div className="space-y-2.5">
            {list.map((s) => {
              const Icon = ICONS[s.item.kind] ?? Wrench
              return (
                <button
                  key={s.item.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="glass w-full rounded-[18px] p-3.5 text-left transition active:scale-[.99]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                        s.state === 'overdue'
                          ? 'bg-danger/15 text-danger'
                          : s.state === 'due'
                            ? 'bg-warn/15 text-warn'
                            : 'bg-white/6 text-brand-teal',
                      )}
                    >
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{s.item.label}</span>
                      <span className="tnum block truncate text-[12px] text-ink-muted">
                        {s.dueLabel}
                      </span>
                    </span>
                    <Badge tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Badge>
                  </div>
                  <div className="mt-3">
                    <ProgressBar
                      value={s.progress}
                      tone={s.state === 'overdue' ? 'danger' : s.state === 'due' ? 'warn' : 'ok'}
                    />
                  </div>
                </button>
              )
            })}
          </div>
          <EstimateNote>
            Die Intervalle sind übliche Richtwerte. Maßgeblich ist immer der Wartungsplan Deines
            Herstellers – trage abweichende Werte über „Anpassen" ein.
          </EstimateNote>
        </section>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.item.label}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <Card>
                <p className="text-[11.5px] text-ink-faint">Intervall</p>
                <p className="tnum mt-1 text-[15px] font-semibold">
                  {selected.item.intervalKm > 0 && `${selected.item.intervalKm.toLocaleString('de-DE')} km`}
                  {selected.item.intervalKm > 0 && selected.item.intervalMonths > 0 && ' / '}
                  {selected.item.intervalMonths > 0 && `${selected.item.intervalMonths} Monate`}
                </p>
              </Card>
              <Card>
                <p className="text-[11.5px] text-ink-faint">Zuletzt erledigt</p>
                <p className="tnum mt-1 text-[15px] font-semibold">
                  {selected.item.lastDoneKm != null
                    ? formatKm(selected.item.lastDoneKm)
                    : formatDate(selected.item.lastDoneAt)}
                </p>
              </Card>
            </div>

            <Card>
              <p className="mb-2 text-[12px] text-ink-faint">Fortschritt bis zur Fälligkeit</p>
              <ProgressBar
                value={selected.progress}
                tone={selected.state === 'overdue' ? 'danger' : selected.state === 'due' ? 'warn' : 'ok'}
              />
              <p className="tnum mt-2 text-[13px] text-ink-muted">{selected.dueLabel}</p>
            </Card>

            <Button
              size="lg"
              full
              icon={<Check size={18} />}
              onClick={() => {
                completeMaintenance(selected.item.id)
                setSelected(null)
              }}
            >
              Jetzt als erledigt eintragen
            </Button>
            <p className="text-center text-[11.5px] text-ink-faint">
              Setzt das Intervall auf den aktuellen Kilometerstand und das heutige Datum zurück.
            </p>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
