import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Camera,
  Car,
  Check,
  Copy,
  Cog,
  Fuel,
  Gauge,
  Palette,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  Input,
  RowGroup,
  Row,
  SectionTitle,
  Sheet,
  cn,
} from '../../components/ui'
import { VehicleImage, VehicleImageCredit } from '../../components/VehicleCard'
import { useActiveVehicle, useAppStore } from '../../store/useAppStore'
import { formatDate, formatKm, formatRelative } from '../../lib/format'
import { fileToDataUrl } from '../../lib/fileStore'

export default function VehicleScreen() {
  const navigate = useNavigate()
  const vehicle = useActiveVehicle()
  const { vehicles, setActiveVehicle, setMileage, updateVehicle, removeVehicle } = useAppStore()
  const [mileageOpen, setMileageOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [newMileage, setNewMileage] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  if (!vehicle) {
    return (
      <Page>
        <PageHeader title="Mein Fahrzeug" backTo="/" />
        <Card className="text-center">
          <p className="mb-4 text-[14px] text-ink-muted">Noch kein Fahrzeug angelegt.</p>
          <Link to="/vehicle/new">
            <Button icon={<Plus size={17} />}>Fahrzeug anlegen</Button>
          </Link>
        </Card>
      </Page>
    )
  }

  const saveMileage = () => {
    const value = Number(newMileage.replace(/\D/g, ''))
    if (value > 0) setMileage(vehicle.id, value)
    setMileageOpen(false)
    setNewMileage('')
  }

  const copyVin = async () => {
    if (!vehicle.vin) return
    await navigator.clipboard.writeText(vehicle.vin)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const setPhoto = async (file?: File) => {
    if (!file) return
    updateVehicle(vehicle.id, { photo: await fileToDataUrl(file, 900) })
  }

  const specs = [
    { icon: <Gauge size={17} />, label: 'Kilometerstand', value: formatKm(vehicle.mileage), onClick: () => { setNewMileage(String(vehicle.mileage)); setMileageOpen(true) } },
    { icon: <Calendar size={17} />, label: 'Erstzulassung', value: formatDate(vehicle.firstRegistration) },
    { icon: <ShieldCheck size={17} />, label: 'HU fällig', value: vehicle.huDue ? `${formatDate(vehicle.huDue)} · ${formatRelative(vehicle.huDue)}` : '—' },
    { icon: <Fuel size={17} />, label: 'Kraftstoff', value: vehicle.fuel },
    { icon: <Cog size={17} />, label: 'Getriebe', value: vehicle.transmission },
    { icon: <Zap size={17} />, label: 'Leistung', value: `${vehicle.powerKw} kW (${Math.round(vehicle.powerKw * 1.36)} PS)` },
    { icon: <Car size={17} />, label: 'Karosserie', value: vehicle.bodyType || '—' },
    { icon: <Palette size={17} />, label: 'Farbe', value: vehicle.color || '—' },
  ]

  return (
    <Page>
      <PageHeader
        title="Mein Fahrzeug"
        backTo="/"
        right={
          <button
            type="button"
            aria-label="Bearbeiten"
            onClick={() => navigate(`/vehicle/${vehicle.id}/edit`)}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Pencil size={18} />
          </button>
        }
      />

      <div className="anim-fade-up space-y-6">
        <Card className="text-center">
          <div className="relative mx-auto mb-2 w-[82%]">
            <VehicleImage vehicle={vehicle} className="h-32 w-full" />
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setPhoto(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="glass absolute right-0 bottom-0 grid h-9 w-9 place-items-center rounded-full text-ink-muted active:scale-95"
              aria-label="Foto aufnehmen"
            >
              <Camera size={16} />
            </button>
          </div>
          <VehicleImageCredit vehicle={vehicle} className="mb-3 px-2" />
          <h2 className="text-[23px] font-bold">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {vehicle.year} · {vehicle.variant || vehicle.bodyType} · {Math.round(vehicle.powerKw * 1.36)} PS
          </p>
          {vehicle.plate && (
            <Badge tone="brand" className="mt-3">
              {vehicle.plate}
            </Badge>
          )}
          {vehicle.vin && (
            <button
              type="button"
              onClick={copyVin}
              className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12px] text-ink-faint active:opacity-70"
            >
              VIN: <span className="font-mono">{vehicle.vin}</span>
              {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
            </button>
          )}
        </Card>

        <section>
          <SectionTitle title="Fahrzeugdaten" />
          <RowGroup>
            {specs.map((s) => (
              <Row
                key={s.label}
                icon={s.icon}
                title={s.label}
                right={
                  <span className="tnum shrink-0 text-[13.5px] font-medium text-ink">{s.value}</span>
                }
                onClick={s.onClick}
              />
            ))}
          </RowGroup>
        </section>

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setNewMileage(String(vehicle.mileage))
              setMileageOpen(true)
            }}
            icon={<Gauge size={17} />}
          >
            km eintragen
          </Button>
          <Button variant="outline" onClick={() => navigate(`/vehicle/${vehicle.id}/edit`)} icon={<Pencil size={16} />}>
            Bearbeiten
          </Button>
        </div>

        <section>
          <SectionTitle title="Meine Fahrzeuge" action={`${vehicles.length}`} />
          <RowGroup>
            {vehicles.map((v) => (
              <Row
                key={v.id}
                icon={<Car size={17} />}
                title={`${v.make} ${v.model}`}
                subtitle={`${v.year} · ${formatKm(v.mileage)}`}
                onClick={() => setActiveVehicle(v.id)}
                right={
                  v.id === vehicle.id ? (
                    <Badge tone="ok">aktiv</Badge>
                  ) : (
                    <span className="text-[12.5px] text-brand-blue">wechseln</span>
                  )
                }
                className={cn(v.id === vehicle.id && 'bg-white/4')}
              />
            ))}
            <Row
              icon={<Plus size={17} />}
              title="Weiteres Fahrzeug anlegen"
              to="/vehicle/new"
            />
          </RowGroup>
        </section>

        {vehicles.length > 1 && (
          <>
            {confirmDelete ? (
              <Card className="border-danger/30">
                <p className="mb-3 text-[13px] text-danger">
                  {vehicle.make} {vehicle.model} mit allen Dokumenten und Einträgen löschen?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    full
                    onClick={() => {
                      removeVehicle(vehicle.id)
                      setConfirmDelete(false)
                    }}
                  >
                    Ja, löschen
                  </Button>
                  <Button variant="outline" size="sm" full onClick={() => setConfirmDelete(false)}>
                    Abbrechen
                  </Button>
                </div>
              </Card>
            ) : (
              <Button variant="ghost" full icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
                Dieses Fahrzeug löschen
              </Button>
            )}
          </>
        )}
      </div>

      <Sheet open={mileageOpen} onClose={() => setMileageOpen(false)} title="Kilometerstand">
        <p className="mb-3 text-[13px] text-ink-muted">
          Zuletzt erfasst am {formatDate(vehicle.mileageUpdatedAt)}. Ein aktueller Stand macht Wartungsplan
          und Wertschätzung genauer.
        </p>
        <Input
          type="text"
          inputMode="numeric"
          value={newMileage}
          onChange={(e) => setNewMileage(e.target.value)}
          placeholder="z. B. 68540"
          autoFocus
        />
        <Button className="mt-4" full size="lg" onClick={saveMileage}>
          Speichern
        </Button>
      </Sheet>

      <Sheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Fahrzeug wechseln">
        <div className="space-y-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setActiveVehicle(v.id)
                setSwitcherOpen(false)
              }}
              className="glass flex w-full items-center gap-3 rounded-xl p-3 text-left"
            >
              <VehicleImage vehicle={v} className="h-9 w-16 shrink-0" />
              <span className="flex-1">
                <span className="block text-[14px] font-medium">
                  {v.make} {v.model}
                </span>
                <span className="block text-[12px] text-ink-muted">{formatKm(v.mileage)}</span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
