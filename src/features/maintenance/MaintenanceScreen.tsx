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
  Pencil,
  Plus,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Timer,
  Trash2,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EstimateNote,
  Field,
  Input,
  ProgressBar,
  SectionTitle,
  Select,
  Sheet,
  cn,
} from '../../components/ui'
import { useActiveVehicle, useAppStore, useVehicleMaintenance } from '../../store/useAppStore'
import {
  kindsForVehicle,
  maintenanceStatus,
  sortByUrgency,
  type MaintenanceStatus,
} from '../../lib/maintenance'
import { formatDate, formatKm, todayIso } from '../../lib/format'
import type { MaintenanceItem, MaintenanceKind } from '../../types'

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

const KIND_LABELS: Record<MaintenanceKind, string> = {
  oil: 'Ölwechsel',
  inspection: 'Inspektion',
  'brake-fluid': 'Bremsflüssigkeit',
  'air-filter': 'Luftfilter',
  'cabin-filter': 'Innenraumfilter',
  'spark-plugs': 'Zünd-/Glühkerzen',
  'timing-belt': 'Zahnriemen/Steuerkette',
  'ac-service': 'Klimaservice',
  tires: 'Reifen',
  battery: 'Batterie',
  hu: 'Hauptuntersuchung',
  chain: 'Antriebskette',
  'valve-clearance': 'Ventilspiel',
  coolant: 'Kühlmittel',
  dpf: 'Partikelfilter',
  'hv-battery': 'Hochvoltbatterie',
}

/** Formularzustand des Bearbeiten-Modus – alles als Text, damit leere Felder möglich sind */
interface EditForm {
  label: string
  kind: MaintenanceKind
  intervalKm: string
  intervalMonths: string
  lastDoneAt: string
  lastDoneKm: string
  note: string
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
  const updateMaintenance = useAppStore((s) => s.updateMaintenance)
  const addMaintenance = useAppStore((s) => s.addMaintenance)
  const removeMaintenance = useAppStore((s) => s.removeMaintenance)

  const [selected, setSelected] = useState<MaintenanceStatus | null>(null)
  const [edit, setEdit] = useState<EditForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addForm, setAddForm] = useState<EditForm | null>(null)
  const [formError, setFormError] = useState('')

  const list = useMemo(() => {
    if (!vehicle) return []
    return sortByUrgency(items.map((m) => maintenanceStatus(m, vehicle)))
  }, [items, vehicle])

  const kinds = useMemo(() => (vehicle ? kindsForVehicle(vehicle) : []), [vehicle])

  if (!vehicle) return null

  const closeSheet = () => {
    setSelected(null)
    setEdit(null)
    setConfirmDelete(false)
    setFormError('')
  }

  const startEdit = (item: MaintenanceItem) => {
    setFormError('')
    setEdit({
      label: item.label,
      kind: item.kind,
      intervalKm: item.intervalKm ? String(item.intervalKm) : '',
      intervalMonths: item.intervalMonths ? String(item.intervalMonths) : '',
      lastDoneAt: dayInput(item.lastDoneAt),
      lastDoneKm: item.lastDoneKm != null ? String(item.lastDoneKm) : '',
      note: item.note ?? '',
    })
  }

  const saveEdit = () => {
    if (!selected || !edit) return
    const km = toNumber(edit.intervalKm) ?? 0
    const months = toNumber(edit.intervalMonths) ?? 0
    if (!edit.label.trim()) {
      setFormError('Bitte eine Bezeichnung angeben.')
      return
    }
    if (km <= 0 && months <= 0) {
      setFormError('Trage mindestens ein Intervall ein – in Kilometern oder in Monaten.')
      return
    }
    const item = selected.item
    updateMaintenance(item.id, {
      label: edit.label.trim(),
      intervalKm: km,
      intervalMonths: months,
      lastDoneKm: toNumber(edit.lastDoneKm),
      lastDoneAt: edit.lastDoneAt ? new Date(edit.lastDoneAt).toISOString() : undefined,
      note: edit.note.trim() || undefined,
      // gemerkt, damit ein späterer Neuaufbau des Plans die eigenen Werte nicht überschreibt
      edited: item.edited || km !== item.intervalKm || months !== item.intervalMonths,
    })
    closeSheet()
  }

  const saveNew = () => {
    if (!addForm) return
    const km = toNumber(addForm.intervalKm) ?? 0
    const months = toNumber(addForm.intervalMonths) ?? 0
    if (!addForm.label.trim()) {
      setFormError('Bitte eine Bezeichnung angeben.')
      return
    }
    if (km <= 0 && months <= 0) {
      setFormError('Trage mindestens ein Intervall ein – in Kilometern oder in Monaten.')
      return
    }
    addMaintenance({
      vehicleId: vehicle.id,
      kind: addForm.kind,
      label: addForm.label.trim(),
      intervalKm: km,
      intervalMonths: months,
      lastDoneKm: toNumber(addForm.lastDoneKm),
      lastDoneAt: addForm.lastDoneAt ? new Date(addForm.lastDoneAt).toISOString() : undefined,
      note: addForm.note.trim() || undefined,
      edited: true,
    })
    setAddForm(null)
    setFormError('')
  }

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
          <Button
            full
            variant="outline"
            className="mt-3"
            icon={<Plus size={17} />}
            onClick={() => {
              setFormError('')
              setAddForm({
                label: '',
                kind: kinds[0] ?? 'inspection',
                intervalKm: '',
                intervalMonths: '',
                lastDoneAt: dayInput(todayIso()),
                lastDoneKm: String(vehicle.mileage),
                note: '',
              })
            }}
          >
            Eigene Wartungsposition anlegen
          </Button>
          <EstimateNote>
            Die Intervalle sind übliche Richtwerte. Maßgeblich ist immer der Wartungsplan Deines
            Herstellers – trage abweichende Werte über „Anpassen" ein.
          </EstimateNote>
        </section>
      </div>

      <Sheet open={!!selected} onClose={closeSheet} title={selected?.item.label}>
        {selected && !edit && (
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

            {selected.item.note && (
              <Card>
                <p className="text-[11.5px] text-ink-faint">Notiz</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{selected.item.note}</p>
              </Card>
            )}

            <Button
              size="lg"
              full
              icon={<Check size={18} />}
              onClick={() => {
                completeMaintenance(selected.item.id)
                closeSheet()
              }}
            >
              Jetzt als erledigt eintragen
            </Button>
            <p className="text-center text-[11.5px] text-ink-faint">
              Setzt das Intervall auf den aktuellen Kilometerstand und das heutige Datum zurück.
            </p>

            <Button full variant="outline" icon={<Pencil size={17} />} onClick={() => startEdit(selected.item)}>
              Anpassen
            </Button>

            {confirmDelete ? (
              <Card className="border-danger/30">
                <p className="text-[13px] text-danger">
                  Diese Position wirklich aus dem Wartungsplan entfernen?
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      removeMaintenance(selected.item.id)
                      closeSheet()
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </Card>
            ) : (
              <Button full variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Position löschen
              </Button>
            )}
          </div>
        )}

        {selected && edit && (
          <div className="space-y-4">
            <MaintenanceFields
              form={edit}
              set={(patch) => setEdit({ ...edit, ...patch })}
              kinds={kinds}
              withKind={false}
            />
            {formError && (
              <p className="rounded-xl bg-danger/12 px-3.5 py-3 text-[13px] text-danger">{formError}</p>
            )}
            <Button size="lg" full icon={<Check size={18} />} onClick={saveEdit}>
              Änderungen speichern
            </Button>
            <Button full variant="ghost" onClick={() => setEdit(null)}>
              Abbrechen
            </Button>
          </div>
        )}
      </Sheet>

      {/* Eigene Position anlegen */}
      <Sheet open={!!addForm} onClose={() => setAddForm(null)} title="Eigene Wartungsposition">
        {addForm && (
          <div className="space-y-4">
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Für Arbeiten, die im Standardplan fehlen – zum Beispiel eine Position aus dem
              Serviceheft Deines Herstellers.
            </p>
            <MaintenanceFields
              form={addForm}
              set={(patch) => setAddForm({ ...addForm, ...patch })}
              kinds={kinds}
              withKind
            />
            {formError && (
              <p className="rounded-xl bg-danger/12 px-3.5 py-3 text-[13px] text-danger">{formError}</p>
            )}
            <Button size="lg" full icon={<Plus size={18} />} onClick={saveNew}>
              Position anlegen
            </Button>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

function MaintenanceFields({
  form,
  set,
  kinds,
  withKind,
}: {
  form: EditForm
  set: (patch: Partial<EditForm>) => void
  kinds: MaintenanceKind[]
  withKind: boolean
}) {
  return (
    <>
      <Field label="Bezeichnung">
        <Input
          value={form.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="z. B. Getriebeöl wechseln"
        />
      </Field>

      {withKind && (
        <Field label="Art" hint="bestimmt das Symbol – nur Arten, die zu Deinem Fahrzeug passen">
          <Select value={form.kind} onChange={(e) => set({ kind: e.target.value as MaintenanceKind })}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Intervall (km)" hint="0 oder leer = nur zeitlich">
          <Input
            type="number"
            inputMode="numeric"
            value={form.intervalKm}
            onChange={(e) => set({ intervalKm: e.target.value })}
            placeholder="z. B. 15000"
          />
        </Field>
        <Field label="Intervall (Monate)" hint="0 oder leer = nur nach km">
          <Input
            type="number"
            inputMode="numeric"
            value={form.intervalMonths}
            onChange={(e) => set({ intervalMonths: e.target.value })}
            placeholder="z. B. 12"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Zuletzt erledigt am">
          <Input
            type="date"
            value={form.lastDoneAt}
            onChange={(e) => set({ lastDoneAt: e.target.value })}
          />
        </Field>
        <Field label="Bei km-Stand">
          <Input
            type="number"
            inputMode="numeric"
            value={form.lastDoneKm}
            onChange={(e) => set({ lastDoneKm: e.target.value })}
            placeholder="optional"
          />
        </Field>
      </div>

      <Field label="Notiz" hint="optional, z. B. Ölsorte oder Werkstatt">
        <Input value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
    </>
  )
}

/** ISO-Datum → Wert für <input type="date"> */
function dayInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Leeres Feld bleibt leer, "0" bleibt 0 – ein Neufahrzeug darf bei 0 km stehen */
function toNumber(value: string) {
  const cleaned = value.replace(/\D/g, '')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}
