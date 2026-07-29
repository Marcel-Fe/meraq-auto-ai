import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Info, ScanLine, Save, Sparkles } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Button, Card, Field, Input, SectionTitle, Segmented, Select } from '../../components/ui'
import { brandsFor } from '../../data/brands'
import { estimateListPrice } from '../../lib/valuation'
import { vehicleProfile } from '../../lib/vehicleProfile'
import { fileToDataUrl } from '../../lib/fileStore'
import { formatEur } from '../../lib/format'
import { askClaudeStructured, describeAiError, hasApiKey, userMessage } from '../../lib/ai/client'
import { SYSTEM_REGISTRATION } from '../../lib/ai/prompts'
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

/** Felder, die im Fahrzeugschein stehen – zugleich die Namen für die Unsicherheits-Markierung */
const SCAN_FIELDS = [
  'kind',
  'make',
  'model',
  'variant',
  'firstRegistration',
  'vin',
  'plate',
  'fuel',
  'powerKw',
  'displacementCcm',
  'co2GramPerKm',
] as const

type ScanField = (typeof SCAN_FIELDS)[number]

const FIELD_LABELS: Record<ScanField, string> = {
  kind: 'Fahrzeugart',
  make: 'Marke (D.1)',
  model: 'Modell (D.3)',
  variant: 'Variante (D.2)',
  firstRegistration: 'Erstzulassung (B)',
  vin: 'Fahrgestellnummer (E)',
  plate: 'Kennzeichen (A)',
  fuel: 'Kraftstoff (P.3)',
  powerKw: 'Leistung (P.2)',
  displacementCcm: 'Hubraum (P.1)',
  co2GramPerKm: 'CO₂ (V.7)',
}

interface RegistrationResult {
  kind?: VehicleKind
  make?: string
  model?: string
  variant?: string
  firstRegistration?: string
  vin?: string
  plate?: string
  fuel?: FuelType
  powerKw?: number
  displacementCcm?: number
  co2GramPerKm?: number
  uncertain?: ScanField[]
  note?: string
}

const REGISTRATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    kind: {
      type: 'string',
      enum: ['car', 'motorcycle', 'van', 'truck', 'bus', 'camper'],
      description:
        'Fahrzeugart aus Feld J: M1 = car, N1 = van (bis 3,5 t) oder truck, N2/N3 = truck, M2/M3 = bus, L3e = motorcycle.',
    },
    make: { type: 'string', description: 'Marke aus Feld D.1, z. B. "Volkswagen"' },
    model: {
      type: 'string',
      description: 'Handelsbezeichnung aus Feld D.3, z. B. "Golf". Nur das Modell, ohne Marke.',
    },
    variant: { type: 'string', description: 'Typ/Variante/Version aus Feld D.2' },
    firstRegistration: { type: 'string', description: 'Erstzulassung aus Feld B im Format JJJJ-MM-TT' },
    vin: { type: 'string', description: 'Fahrzeug-Identifizierungsnummer aus Feld E, 17 Stellen' },
    plate: { type: 'string', description: 'Amtliches Kennzeichen, z. B. "M-BR 6156"' },
    fuel: {
      type: 'string',
      enum: ['Diesel', 'Benzin', 'Elektro', 'Hybrid', 'Plug-in-Hybrid', 'LPG', 'CNG'],
      description: 'Kraftstoffart aus Feld P.3, auf diese Auswahl abgebildet',
    },
    powerKw: { type: 'number', description: 'Nennleistung in kW aus Feld P.2' },
    displacementCcm: { type: 'number', description: 'Hubraum in cm³ aus Feld P.1' },
    co2GramPerKm: { type: 'number', description: 'CO₂-Ausstoß in g/km aus Feld V.7' },
    uncertain: {
      type: 'array',
      items: { type: 'string', enum: SCAN_FIELDS },
      description: 'Namen der Felder, bei denen Du Dir nicht sicher bist. Die App markiert sie zur Prüfung.',
    },
    note: {
      type: 'string',
      description: 'Hinweis, wenn etwas fehlt oder das Bild unbrauchbar ist. Sonst weglassen.',
    },
  },
  required: [],
}

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

  // Fahrzeugschein-Scan: füllt das Formular vor, gespeichert wird trotzdem erst
  // über "Fahrzeug anlegen" – der Nutzer sieht also jeden Wert vorher.
  const scanRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanned, setScanned] = useState<{ filled: ScanField[]; uncertain: ScanField[]; note?: string } | null>(null)

  const brands = useMemo(() => brandsFor(form.kind), [form.kind])

  // Vorschau der Wertschätzung: zeigt sofort, was die eingegebenen Daten bewirken
  const preview = useMemo(() => {
    if (!form.make.trim() || !form.model.trim() || form.year < 1900) return null
    const draft: Vehicle = {
      ...form,
      id: 'preview',
      createdAt: new Date().toISOString(),
      mileageUpdatedAt: new Date().toISOString(),
    }
    return { profile: vehicleProfile(draft), listPrice: estimateListPrice(draft) }
  }, [form])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const scan = async (file?: File) => {
    if (!file) return
    if (!hasApiKey()) {
      setScanError('Zum Auslesen brauchst Du einen API-Schlüssel. Du trägst ihn in den Einstellungen ein.')
      return
    }
    setScanning(true)
    setScanError('')
    setScanned(null)
    try {
      const image = await fileToDataUrl(file, 1800)
      const res = await askClaudeStructured<RegistrationResult>({
        system: SYSTEM_REGISTRATION,
        messages: [userMessage('Lies diesen Fahrzeugschein aus.', image)],
        toolName: 'fahrzeugschein_uebernehmen',
        toolDescription:
          'Trägt die Angaben des Fahrzeugscheins in das Formular ein, das der Nutzer anschließend prüft und speichert.',
        schema: REGISTRATION_SCHEMA,
      })

      const filled: ScanField[] = []
      const patch: Partial<FormState> = {}
      for (const field of SCAN_FIELDS) {
        const value = res[field]
        if (value === undefined || value === null || value === '') continue
        ;(patch as Record<string, unknown>)[field] = value
        filled.push(field)
      }
      // Das Baujahr steht nicht eigens im Schein – es ergibt sich aus der Erstzulassung
      const regYear = res.firstRegistration ? new Date(res.firstRegistration).getFullYear() : NaN
      if (Number.isFinite(regYear) && regYear > 1900) patch.year = regYear

      if (filled.length === 0) {
        setScanError(
          res.note ||
            'Auf dem Bild war kein Fahrzeugschein zu erkennen. Fotografiere die aufgeklappte Zulassungsbescheinigung Teil I bei gutem Licht.',
        )
        return
      }

      setForm((f) => ({ ...f, ...patch }))
      setScanned({
        filled,
        uncertain: (res.uncertain ?? []).filter((u) => filled.includes(u)),
        note: res.note,
      })
    } catch (err) {
      setScanError(describeAiError(err))
    } finally {
      setScanning(false)
      if (scanRef.current) scanRef.current.value = ''
    }
  }

  /** Hinweistext eines Feldes, ergänzt um die Prüfbitte nach einem Scan */
  const hintFor = (field: ScanField, base?: string) => {
    if (!scanned?.uncertain.includes(field)) return base
    return base ? `${base} · unsicher gelesen – bitte prüfen` : 'Unsicher gelesen – bitte prüfen'
  }

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

      <input
        ref={scanRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => scan(e.target.files?.[0])}
      />

      <div className="anim-fade-up space-y-6">
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-violet/15 text-brand-violet">
              <ScanLine size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Fahrzeugschein abfotografieren</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Die KI liest Marke, Typ, Erstzulassung, Leistung, Hubraum und CO₂ aus und füllt das
                Formular vor. Gespeichert wird nichts – Du prüfst jeden Wert selbst.
              </p>
            </div>
          </div>
          <Button
            full
            variant="outline"
            className="mt-3"
            loading={scanning}
            icon={<Sparkles size={17} />}
            onClick={() => scanRef.current?.click()}
          >
            {scanning ? 'Wird gelesen…' : 'Fahrzeugschein fotografieren'}
          </Button>
        </Card>

        {scanError && (
          <Card className="border-danger/30">
            <p className="text-[13px] text-danger">{scanError}</p>
            {!hasApiKey() && (
              <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                API-Schlüssel eintragen
              </Link>
            )}
          </Card>
        )}

        {scanned && (
          <Card className="border-brand-blue/30">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
              <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-muted">
                <p>
                  Aus dem Fahrzeugschein übernommen:{' '}
                  <strong className="text-ink">
                    {scanned.filled.map((f) => FIELD_LABELS[f]).join(', ')}
                  </strong>
                  . Bitte alle Werte gegenlesen – erst mit „{existing ? 'Änderungen speichern' : 'Fahrzeug anlegen'}"
                  werden sie gespeichert.
                </p>
                {scanned.note && <p className="mt-2">{scanned.note}</p>}
              </div>
            </div>
            {scanned.uncertain.length > 0 && (
              <div className="mt-3 flex items-start gap-2.5 border-t border-white/8 pt-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
                <p className="text-[12.5px] leading-relaxed text-warn">
                  Unsicher gelesen: {scanned.uncertain.map((f) => FIELD_LABELS[f]).join(', ')}. Diese
                  Werte solltest Du besonders genau prüfen.
                </p>
              </div>
            )}
          </Card>
        )}

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
              <Field label="Marke *" hint={hintFor('make')}>
                {/* Vorschlagsliste, aber freie Eingabe – auch Nischenmarken sollen gehen */}
                <Input
                  value={form.make}
                  onChange={(e) => set('make', e.target.value)}
                  placeholder="z. B. Volkswagen"
                  list="marken-liste"
                  autoComplete="off"
                />
                <datalist id="marken-liste">
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Modell *" hint={hintFor('model')}>
                <Input
                  value={form.model}
                  onChange={(e) => set('model', e.target.value)}
                  placeholder="z. B. Golf"
                />
              </Field>
            </div>
            <Field label="Variante" hint={hintFor('variant', 'optional, z. B. G20 Limousine')}>
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
              <Field label="Kraftstoff" hint={hintFor('fuel')}>
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
              <Field label="Leistung (kW)" hint={hintFor('powerKw', `≈ ${Math.round(form.powerKw * 1.36)} PS`)}>
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
            {/* Hubraum und CO₂ stehen im Fahrzeugschein und sind die Basis der Kfz-Steuer */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hubraum (cm³)" hint={hintFor('displacementCcm', 'Feld P.1')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.displacementCcm ?? ''}
                  onChange={(e) =>
                    set('displacementCcm', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="z. B. 1968"
                />
              </Field>
              <Field label="CO₂ (g/km)" hint={hintFor('co2GramPerKm', 'Feld V.7')}>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={form.co2GramPerKm ?? ''}
                  onChange={(e) =>
                    set('co2GramPerKm', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="z. B. 128"
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
            <Field label="Fahrgestellnummer (VIN)" hint={hintFor('vin', 'Steht im Fahrzeugschein unter Feld E')}>
              <Input
                value={form.vin ?? ''}
                onChange={(e) => set('vin', e.target.value.toUpperCase())}
                placeholder="WBA..."
                className="font-mono text-[13px]"
              />
            </Field>
            <Field label="Kennzeichen" hint={hintFor('plate')}>
              <Input
                value={form.plate ?? ''}
                onChange={(e) => set('plate', e.target.value.toUpperCase())}
                placeholder="M-BR 6156"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Erstzulassung" hint={hintFor('firstRegistration')}>
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
                placeholder={preview ? String(preview.listPrice) : 'z. B. 32000'}
              />
            </Field>
          </Card>
        </section>

        {preview && (
          <Card>
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
              <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-muted">
                <p>
                  So rechnet die App mit diesem Fahrzeug: <strong className="text-ink">{preview.profile.sizeLabel}</strong>,{' '}
                  <strong className="text-ink">{preview.profile.brandLabel}</strong>.
                  Teilepreise ×{preview.profile.partsFactor.toFixed(2)}, Arbeitszeiten ×
                  {preview.profile.laborFactor.toFixed(2)} gegenüber einem Kompaktwagen.
                </p>
                {!form.listPriceNew && (
                  <p className="mt-2">
                    Ohne Neupreis rechnet die Wertschätzung mit geschätzten{' '}
                    <strong className="text-ink">{formatEur(preview.listPrice)}</strong>. Trägst Du
                    den echten Neupreis ein, wird der Marktwert deutlich genauer.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

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
