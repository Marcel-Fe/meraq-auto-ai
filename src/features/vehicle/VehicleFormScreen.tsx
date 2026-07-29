import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Button, Card, Field, Input, SectionTitle, Segmented, Select } from '../../components/ui'
import { useAppStore } from '../../store/useAppStore'
import type { Condition, FuelType, Transmission, Vehicle, VehicleKind } from '../../types'

const KINDS: { value: VehicleKind; label: string }[] = [
  { value: 'car', label: 'Auto' },
  { value: 'motorcycle', label: 'Motorrad' },
  { value: 'van', label: 'Transporter' },
  { value: 'truck', label: 'LKW' },
  { value: 'bus', label: 'Bus' },
  { value: 'camper', label: 'Wohnmobil' },
]

const FUELS: FuelType[] = ['Diesel', 'Benzin', 'Elektro', 'Hybrid', 'Plug-in-Hybrid', 'LPG', 'CNG']
const TRANSMISSIONS: Transmission[] = ['Automatik', 'Schaltgetriebe']
const CONDITIONS: Condition[] = ['sehr gut', 'gut', 'befriedigend', 'reparaturbedürftig']

type FormState = Omit<Vehicle, 'id' | 'createdAt' | 'mileageUpdatedAt'>

const emptyForm: FormState = {
  kind: 'car',
  make: '',
  model: '',
  variant: '',
  year: new Date().getFullYear() - 5,
  mileage: 0,
  vin: '',
  plate: '',
  fuel: 'Benzin',
  transmission: 'Schaltgetriebe',
  powerKw: 100,
  bodyType: '',
  firstRegistration: '',
  huDue: '',
  condition: 'gut',
  listPriceNew: undefined,
  color: '',
}

export default function VehicleFormScreen() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { vehicles, addVehicle, updateVehicle } = useAppStore()
  const existing = vehicles.find((v) => v.id === id)

  const [form, setForm] = useState<FormState>(() => {
    if (!existing) return emptyForm
    const { id: _id, createdAt: _c, mileageUpdatedAt: _m, ...rest } = existing
    return rest
  })
  const [error, setError] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    if (!form.make.trim() || !form.model.trim()) {
      setError('Bitte Marke und Modell ausfüllen – ohne diese Angaben kann die App nichts berechnen.')
      return
    }
    if (form.year < 1900 || form.year > new Date().getFullYear() + 1) {
      setError('Bitte ein gültiges Baujahr angeben.')
      return
    }
    if (existing) {
      updateVehicle(existing.id, form)
      navigate('/vehicle')
    } else {
      addVehicle(form)
      navigate('/vehicle')
    }
  }

  return (
    <Page>
      <PageHeader title={existing ? 'Fahrzeug bearbeiten' : 'Fahrzeug anlegen'} backTo="/vehicle" />

      <div className="anim-fade-up space-y-6">
        <section>
          <SectionTitle title="Fahrzeugart" />
          <Segmented
            options={KINDS.slice(0, 3)}
            value={form.kind}
            onChange={(v) => set('kind', v)}
            className="mb-2"
          />
          <Segmented options={KINDS.slice(3)} value={form.kind} onChange={(v) => set('kind', v)} />
        </section>

        <section>
          <SectionTitle title="Grunddaten" />
          <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marke *">
                <Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="BMW" />
              </Field>
              <Field label="Modell *">
                <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="320d" />
              </Field>
            </div>
            <Field label="Variante" hint="optional, z. B. G20 Limousine">
              <Input value={form.variant ?? ''} onChange={(e) => set('variant', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Baujahr *">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => set('year', Number(e.target.value))}
                />
              </Field>
              <Field label="Kilometerstand *">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.mileage}
                  onChange={(e) => set('mileage', Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle title="Technik" />
          <Card className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kraftstoff">
                <Select value={form.fuel} onChange={(e) => set('fuel', e.target.value as FuelType)}>
                  {FUELS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Getriebe">
                <Select
                  value={form.transmission}
                  onChange={(e) => set('transmission', e.target.value as Transmission)}
                >
                  {TRANSMISSIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Leistung (kW)" hint={`≈ ${Math.round(form.powerKw * 1.36)} PS`}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.powerKw}
                  onChange={(e) => set('powerKw', Number(e.target.value))}
                />
              </Field>
              <Field label="Karosserie">
                <Input
                  value={form.bodyType ?? ''}
                  onChange={(e) => set('bodyType', e.target.value)}
                  placeholder="Limousine"
                />
              </Field>
            </div>
            <Field label="Farbe">
              <Input value={form.color ?? ''} onChange={(e) => set('color', e.target.value)} />
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle title="Papiere & Termine" />
          <Card className="space-y-4">
            <Field label="Fahrgestellnummer (VIN)" hint="Steht im Fahrzeugschein unter Feld E">
              <Input
                value={form.vin ?? ''}
                onChange={(e) => set('vin', e.target.value.toUpperCase())}
                placeholder="WBA..."
                className="font-mono text-[13px]"
              />
            </Field>
            <Field label="Kennzeichen">
              <Input
                value={form.plate ?? ''}
                onChange={(e) => set('plate', e.target.value.toUpperCase())}
                placeholder="M-BR 6156"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Erstzulassung">
                <Input
                  type="date"
                  value={form.firstRegistration?.slice(0, 10) ?? ''}
                  onChange={(e) => set('firstRegistration', e.target.value)}
                />
              </Field>
              <Field label="HU fällig">
                <Input
                  type="date"
                  value={form.huDue?.slice(0, 10) ?? ''}
                  onChange={(e) => set('huDue', e.target.value)}
                />
              </Field>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle title="Für die Wertschätzung" />
          <Card className="space-y-4">
            <Field label="Zustand">
              <Select
                value={form.condition}
                onChange={(e) => set('condition', e.target.value as Condition)}
              >
                {CONDITIONS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field
              label="Neupreis (€)"
              hint="Wenn bekannt, wird die Wertschätzung deutlich genauer. Sonst wird geschätzt."
            >
              <Input
                type="number"
                inputMode="numeric"
                value={form.listPriceNew ?? ''}
                onChange={(e) => set('listPriceNew', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="z. B. 46500"
              />
            </Field>
          </Card>
        </section>

        {error && (
          <p className="rounded-xl bg-danger/12 px-3.5 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        <Button size="lg" full icon={<Save size={18} />} onClick={save}>
          {existing ? 'Änderungen speichern' : 'Fahrzeug anlegen'}
        </Button>
      </div>
    </Page>
  )
}
