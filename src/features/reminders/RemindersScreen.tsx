import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CalendarPlus, FileText, ShieldCheck, Wrench } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EstimateNote,
  Row,
  RowGroup,
  SectionTitle,
} from '../../components/ui'
import {
  useActiveVehicle,
  useVehicleDocuments,
  useVehicleMaintenance,
} from '../../store/useAppStore'
import { buildIcs, collectReminders, type Reminder, type ReminderKind } from '../../lib/reminders'
import { formatDate, formatRelative } from '../../lib/format'

const ICONS: Record<ReminderKind, typeof Wrench> = {
  hu: ShieldCheck,
  maintenance: Wrench,
  document: FileText,
}

export default function RemindersScreen() {
  const vehicle = useActiveVehicle()
  const maintenance = useVehicleMaintenance()
  const documents = useVehicleDocuments()
  const [exported, setExported] = useState(false)

  const reminders = useMemo(
    () => (vehicle ? collectReminders(vehicle, maintenance, documents) : []),
    [vehicle, maintenance, documents],
  )

  const upcoming = reminders.filter((r) => !r.overdue)
  const overdue = reminders.filter((r) => r.overdue)

  if (!vehicle) return null

  const exportIcs = () => {
    if (upcoming.length === 0) return
    const ics = buildIcs(upcoming, `${vehicle.make} ${vehicle.model} – Termine`)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meraq-termine-${vehicle.make}-${vehicle.model}.ics`.replace(/\s+/g, '-').toLowerCase()
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
  }

  return (
    <Page>
      <PageHeader title="Erinnerungen" subtitle={`${vehicle.make} ${vehicle.model}`} backTo="/more" />

      <div className="anim-fade-up space-y-6">
        {reminders.length === 0 ? (
          <EmptyState
            icon={<BellRing size={26} />}
            title="Noch keine Termine"
            text="Termine entstehen aus dem HU-Datum, den zeitlichen Wartungsintervallen und den Ablaufdaten Deiner Dokumente."
            action={
              <Link to="/vehicle">
                <Button>HU-Datum eintragen</Button>
              </Link>
            }
          />
        ) : (
          <>
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/15 text-brand-teal">
                  <CalendarPlus size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">In Deinen Kalender legen</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                    Du bekommst eine Kalender-Datei mit {upcoming.length}{' '}
                    {upcoming.length === 1 ? 'Termin' : 'Terminen'}. Auf dem iPhone tippst Du die
                    Datei an und wählst „Zu Kalender hinzufügen", auf Android öffnest Du sie mit der
                    Kalender-App. Ab dann erinnert Dich Dein Kalender – rechtzeitig vorher.
                  </p>
                </div>
              </div>
              <Button
                full
                size="lg"
                className="mt-3"
                icon={<CalendarPlus size={18} />}
                onClick={exportIcs}
                disabled={upcoming.length === 0}
              >
                {exported ? 'Datei erneut erzeugen' : 'Termine als Kalender-Datei'}
              </Button>
            </Card>

            {overdue.length > 0 && (
              <section>
                <SectionTitle title="Überfällig" action={`${overdue.length}`} />
                <RowGroup>
                  {overdue.map((r) => (
                    <ReminderRow key={r.id} reminder={r} />
                  ))}
                </RowGroup>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
                  Diese Termine liegen in der Vergangenheit und kommen nicht in die Kalender-Datei –
                  ein vergangener Eintrag erinnert Dich nicht mehr.
                </p>
              </section>
            )}

            {upcoming.length > 0 && (
              <section>
                <SectionTitle title="Kommt auf Dich zu" action={`${upcoming.length}`} />
                <RowGroup>
                  {upcoming.map((r) => (
                    <ReminderRow key={r.id} reminder={r} />
                  ))}
                </RowGroup>
              </section>
            )}
          </>
        )}

        <EstimateNote>
          Hier steht nur, was sich wirklich datieren lässt: HU-Termin, zeitliche
          Wartungsintervalle und Ablaufdaten Deiner Dokumente. Wartungspositionen, die nur nach
          Kilometern fällig werden, haben kein Datum – wann Du sie erreichst, hängt davon ab, wie
          viel Du fährst. Die App schickt selbst keine Benachrichtigungen, weil sie ohne Server
          läuft; das Erinnern übernimmt Dein Kalender.
        </EstimateNote>
      </div>
    </Page>
  )
}

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const Icon = ICONS[reminder.kind]
  const days = Math.round((new Date(reminder.date).getTime() - Date.now()) / 86_400_000)
  return (
    <Row
      icon={<Icon size={17} />}
      title={reminder.title}
      subtitle={`${formatDate(reminder.date)} · ${formatRelative(reminder.date)}`}
      right={
        reminder.overdue ? (
          <Badge tone="danger">überfällig</Badge>
        ) : days <= 30 ? (
          <Badge tone="warn">bald</Badge>
        ) : undefined
      }
    />
  )
}
