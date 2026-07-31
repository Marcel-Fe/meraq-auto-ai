import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BellRing,
  BookOpen,
  Box,
  Calculator,
  Car,
  Crosshair,
  Droplet,
  FileSpreadsheet,
  FileText,
  Gauge,
  KeyRound,
  MapPin,
  PiggyBank,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { HomeHeader, Page } from '../../app/AppShell'
import { Badge, Button, Card, EmptyState, ProgressBar, SectionTitle, Tile, cn } from '../../components/ui'
import { VehicleCard } from '../../components/VehicleCard'
import { Sparkline } from '../../components/Sparkline'
import {
  useActiveVehicle,
  useAppStore,
  useVehicleActivities,
  useVehicleMaintenance,
} from '../../store/useAppStore'
import { valuate, valueHistory } from '../../lib/valuation'
import { maintenanceStatus, sortByUrgency } from '../../lib/maintenance'
import { formatDate, formatEur, formatRelative } from '../../lib/format'
import { hasApiKey } from '../../lib/ai/client'

const QUICK_ACTIONS = [
  { icon: <Crosshair size={22} />, label: 'Teil im Foto', to: '/part-finder', accent: 'teal' as const },
  { icon: <Activity size={22} />, label: 'Diagnose', to: '/diagnosis', accent: 'blue' as const },
  { icon: <Wrench size={22} />, label: 'Wartung', to: '/maintenance', accent: 'violet' as const },
  { icon: <Box size={22} />, label: 'Handbuch', to: '/manual', accent: 'teal' as const },
  { icon: <BookOpen size={22} />, label: 'Anleitungen', to: '/guides', accent: 'blue' as const },
  { icon: <TrendingUp size={22} />, label: 'Marktwert', to: '/value', accent: 'green' as const },
  { icon: <ShoppingCart size={22} />, label: 'Teile & Preise', to: '/parts', accent: 'amber' as const },
  { icon: <Calculator size={22} />, label: 'Reparaturkosten', to: '/repair-costs', accent: 'violet' as const },
  { icon: <PiggyBank size={22} />, label: 'Was es kostet', to: '/costs', accent: 'green' as const },
  { icon: <Search size={22} />, label: 'Nachschlagen', to: '/lookup', accent: 'teal' as const },
  { icon: <FileSpreadsheet size={22} />, label: 'Voranschlag', to: '/quote', accent: 'amber' as const },
  { icon: <MapPin size={22} />, label: 'Werkstatt', to: '/workshops', accent: 'blue' as const },
]

const ACTIVITY_ICONS = {
  oil: Droplet,
  invoice: Receipt,
  diagnosis: Stethoscope,
  reminder: BellRing,
  document: FileText,
  mileage: Gauge,
  repair: Wrench,
}

export default function DashboardScreen() {
  const vehicle = useActiveVehicle()
  const activities = useVehicleActivities()
  const maintenance = useVehicleMaintenance()
  const userName = useAppStore((s) => s.settings.userName)
  const keySet = hasApiKey()

  const valuation = useMemo(() => (vehicle ? valuate(vehicle) : null), [vehicle])
  const history = useMemo(() => (vehicle ? valueHistory(vehicle, 12) : []), [vehicle])

  const urgent = useMemo(() => {
    if (!vehicle) return []
    return sortByUrgency(maintenance.map((m) => maintenanceStatus(m, vehicle)))
      .filter((s) => s.state !== 'ok')
      .slice(0, 3)
  }, [maintenance, vehicle])

  if (!vehicle) {
    return (
      <Page>
        <HomeHeader />
        <EmptyState
          icon={<Car size={26} />}
          title="Noch kein Fahrzeug angelegt"
          text="Lege Dein Fahrzeug an – danach kennt die App Deine Daten und kann konkret rechnen."
          action={
            <Link to="/vehicle/new">
              <Button>Fahrzeug anlegen</Button>
            </Link>
          }
        />
      </Page>
    )
  }

  const trend = history.length > 1 ? history[history.length - 1].value - history[0].value : 0
  const trendPct = history.length > 1 && history[0].value ? (trend / history[0].value) * 100 : 0

  return (
    <Page>
      <HomeHeader
        right={
          <Link
            to="/assistant"
            aria-label="KI-Assistent"
            className="relative grid h-10 w-10 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Sparkles size={20} />
            {!keySet && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-danger" />
            )}
          </Link>
        }
      />

      <div className="anim-fade-up space-y-6">
        <div>
          <h1 className="text-[24px] leading-tight font-bold">
            Hallo{userName ? ` ${userName}` : ''} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-0.5 text-[13.5px] text-ink-muted">Dein Fahrzeug im Überblick</p>
        </div>

        <VehicleCard vehicle={vehicle} />

        {!keySet && (
          <Link
            to="/settings"
            className="glass flex items-center gap-3 rounded-[18px] border-brand-blue/30 p-3.5 active:scale-[.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue/15 text-brand-blue">
              <KeyRound size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">KI-Assistent aktivieren</span>
              <span className="block text-[12px] text-ink-muted">
                Kostenlos einrichten – dauert eine Minute
              </span>
            </span>
          </Link>
        )}

        <div className="grid grid-cols-4 gap-2.5">
          {QUICK_ACTIONS.map((a) => (
            <Tile key={a.to} icon={a.icon} label={a.label} to={a.to} accent={a.accent} />
          ))}
        </div>

        {valuation && (
          <section>
            <SectionTitle title="Aktueller Marktwert" action="Details" to="/value" />
            <Card>
              <div className="flex items-end justify-between gap-3">
                <p className="tnum text-[30px] leading-none font-bold">{formatEur(valuation.privateSale)}</p>
                <Badge tone={trend >= 0 ? 'ok' : 'danger'}>
                  {trend >= 0 ? '+' : ''}
                  {trendPct.toFixed(1)} %
                </Badge>
              </div>
              <p className="mt-1.5 text-[12px] text-ink-faint">
                Schätzung für Privatverkauf · letzte 12 Monate
              </p>
              <div className="mt-3">
                <Sparkline values={history.map((h) => h.value)} />
              </div>
            </Card>
          </section>
        )}

        {urgent.length > 0 && (
          <section>
            <SectionTitle title="Demnächst fällig" action="Wartungsplan" to="/maintenance" />
            <Card className="space-y-3.5">
              {urgent.map((s) => (
                <div key={s.item.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-medium">{s.item.label}</span>
                    <span
                      className={cn(
                        'tnum shrink-0 text-[11.5px]',
                        s.state === 'overdue' ? 'text-danger' : 'text-ink-muted',
                      )}
                    >
                      {s.dueLabel}
                    </span>
                  </div>
                  <ProgressBar
                    value={s.progress}
                    tone={s.state === 'overdue' ? 'danger' : s.state === 'due' ? 'warn' : 'ok'}
                  />
                </div>
              ))}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle title="Letzte Aktivitäten" action="Alle" to="/more" />
          <Card padded={false} className="divide-y divide-white/6">
            {activities.slice(0, 5).map((a) => {
              const Icon = ACTIVITY_ICONS[a.icon] ?? FileText
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-brand-teal">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{a.title}</span>
                    {a.detail && (
                      <span className="block truncate text-[12px] text-ink-muted">{a.detail}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[11.5px] text-ink-faint">{formatDate(a.date)}</span>
                    {a.costEur != null && (
                      <span className="tnum block text-[11.5px] font-medium text-ink-muted">
                        {formatEur(a.costEur)}
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
            {activities.length === 0 && (
              <p className="px-4 py-6 text-center text-[13px] text-ink-faint">
                Noch keine Aktivitäten erfasst.
              </p>
            )}
          </Card>
        </section>

        {vehicle.huDue && (
          <Card className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn/15 text-warn">
              <BellRing size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Hauptuntersuchung</span>
              <span className="block text-[12.5px] text-ink-muted">
                fällig {formatDate(vehicle.huDue)} · {formatRelative(vehicle.huDue)}
              </span>
            </span>
            <Link to="/workshops" className="shrink-0 text-[13px] font-medium text-brand-blue">
              Werkstatt
            </Link>
          </Card>
        )}

        <Link
          to="/assistant"
          className="glass-strong flex items-center gap-3 rounded-[20px] p-4 active:scale-[.99]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-violet/18 text-brand-violet">
            <Sparkles size={23} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">KI-Assistent</span>
            <span className="block text-[12.5px] text-ink-muted">
              Stelle jede Frage zu Deinem {vehicle.make} {vehicle.model}
            </span>
          </span>
        </Link>

        <p className="pt-2 text-center text-[11px] leading-relaxed text-ink-faint">
          Marktwert, Teile- und Reparaturpreise sind Schätzungen auf Basis offengelegter Formeln –
          keine verbindlichen Angebote.
        </p>
      </div>
    </Page>
  )
}
