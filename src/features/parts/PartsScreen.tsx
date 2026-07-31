import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Search, ShoppingCart, Sparkles } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EstimateNote,
  Input,
  Segmented,
  Sheet,
  cn,
} from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { VehicleImage, VehicleImageCredit } from '../../components/VehicleCard'
import { PART_CATEGORIES, partsFor } from '../../data/parts'
import { formatEurCents } from '../../lib/format'
import { vehicleProfile } from '../../lib/vehicleProfile'
import { useActiveVehicle } from '../../store/useAppStore'
import { askAi, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_PART_LOOKUP, vehicleContext } from '../../lib/ai/prompts'
import type { Part } from '../../types'

export default function PartsScreen() {
  const vehicle = useActiveVehicle()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof PART_CATEGORIES)[number]>('Alle')
  const [selected, setSelected] = useState<Part | null>(null)
  const [lookup, setLookup] = useState('')
  const [loading, setLoading] = useState(false)

  const allParts = useMemo(() => (vehicle ? partsFor(vehicle) : []), [vehicle])
  const profile = useMemo(() => (vehicle ? vehicleProfile(vehicle) : null), [vehicle])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allParts.filter(
      (p) =>
        (category === 'Alle' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    )
  }, [allParts, query, category])

  // Kategorien ausblenden, für die dieses Fahrzeug gar keine Teile hat
  const categories = useMemo(() => {
    const present = new Set(allParts.map((p) => p.category))
    return PART_CATEGORIES.filter((c) => c === 'Alle' || present.has(c))
  }, [allParts])

  if (!vehicle) return null

  const findPartNumber = async (part: Part) => {
    setLookup('')
    if (!hasApiKey()) {
      setLookup('_Für die Teilenummer-Suche brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen)._')
      return
    }
    setLoading(true)
    let acc = ''
    try {
      await askAi({
        system: SYSTEM_PART_LOOKUP,
        context: vehicleContext(vehicle),
        messages: [
          {
            role: 'user',
            content:
              `Ich brauche das Teil "${part.name}" (Kategorie ${part.category}) für mein Fahrzeug.\n\n` +
              (vehicle.vin
                ? `Meine Fahrgestellnummer lautet ${vehicle.vin} – sage mir, was sich daraus ableiten lässt.\n\n`
                : `Meine Fahrgestellnummer habe ich noch nicht eingetragen.\n\n`) +
              `Welche Ausführung brauche ich, welche Hersteller kommen infrage, worin ` +
              `unterscheiden sich die Varianten und woran erkenne ich die richtige?`,
          },
        ],
        onText: (d) => {
          acc += d
          setLookup(acc)
        },
      })
    } catch (err) {
      setLookup(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Teile & Preise"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/"
      />

      <div className="anim-fade-up space-y-4">
        <Card className="flex items-center gap-3">
          <VehicleImage vehicle={vehicle} className="h-16 w-[40%] shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold">
              {vehicle.make} {vehicle.model}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {vehicle.year} · {vehicle.fuel} · {Math.round(vehicle.powerKw * 1.36)} PS
            </p>
            <p className="mt-1 text-[11.5px] text-ink-faint">
              {allParts.length} Teile passen zu diesem Fahrzeug
            </p>
          </div>
        </Card>
        <VehicleImageCredit vehicle={vehicle} />

        <div className="relative">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Teil suchen…"
            className="pl-10"
          />
        </div>

        <Segmented options={categories} value={category} onChange={setCategory} />

        {list.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={26} />}
            title="Kein Teil gefunden"
            text="Versuche einen anderen Suchbegriff, oder frage den KI-Assistenten nach dem passenden Teil für Dein Fahrzeug."
          />
        ) : (
          <div className="space-y-2.5">
            {list.map((p) => {
              const usable = p.offers.filter((o) => o.priceEur > 0)
              const cheapest = usable.slice().sort((a, b) => a.priceEur - b.priceEur)[0]
              const original = p.offers.find((o) => o.quality === 'Originalteil')
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p)
                    setLookup('')
                  }}
                  className="glass flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left transition active:scale-[.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{p.name}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">{p.category}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[15px] font-bold">
                      ab {cheapest ? formatEurCents(cheapest.priceEur) : '—'}
                    </span>
                    {original && original.priceEur > 0 && (
                      <span className="tnum block text-[11px] text-ink-faint">
                        Original {formatEurCents(original.priceEur)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {profile && (
          <EstimateNote>
            Preise sind auf Dein Fahrzeug umgerechnet: <strong className="text-ink">{profile.sizeLabel}</strong>,{' '}
            <strong className="text-ink">{profile.brandLabel}</strong>, {vehicle.powerKw} kW
            → Faktor ×{profile.partsFactor.toFixed(2)} gegenüber einem Kompaktwagen einer
            Volumenmarke. Es sind Orientierungswerte aus dem deutschen Teilehandel, keine
            Live-Abfrage bei Händlern.
          </EstimateNote>
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[13px] font-semibold">Preisvergleich nach Qualität</p>
              <div className="space-y-2">
                {selected.offers.map((o) => (
                  <div
                    key={o.quality}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl p-3',
                      o.priceEur > 0 ? 'glass' : 'border border-white/6 bg-white/2 opacity-60',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium">{o.quality}</span>
                        {o.quality === 'Originalteil' && <Badge tone="brand">Hersteller</Badge>}
                      </span>
                      {o.note && (
                        <span className="mt-0.5 block text-[11.5px] text-ink-faint">{o.note}</span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-[15px] font-bold">
                      {o.priceEur > 0 ? formatEurCents(o.priceEur) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selected.fitsNote && (
              <Card>
                <div className="flex items-start gap-2.5">
                  <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">{selected.fitsNote}</p>
                </div>
              </Card>
            )}

            {/* Teilenummern werden bewusst nicht geraten – sie gelten immer nur für eine
                bestimmte Baureihe und Motorvariante. */}
            {lookup ? (
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-violet" />
                  <span className="text-[12.5px] font-semibold">
                    Passendes Teil für {vehicle.make} {vehicle.model}
                  </span>
                </div>
                <div className="text-[13.5px] text-ink-muted">
                  <Markdown text={lookup} />
                  {loading && <span className="inline-block animate-pulse">▍</span>}
                </div>
                {!hasApiKey() && (
                  <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                    Kostenlos einrichten
                  </Link>
                )}
              </Card>
            ) : (
              <div>
                <Button
                  full
                  variant="outline"
                  loading={loading}
                  icon={<Sparkles size={16} />}
                  onClick={() => findPartNumber(selected)}
                >
                  Passendes Teil für mein Fahrzeug finden
                </Button>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
                  {vehicle.vin
                    ? 'Deine Fahrgestellnummer wird mitgeschickt – damit wird die Auskunft konkreter.'
                    : 'Trage Deine Fahrgestellnummer beim Fahrzeug ein, dann kann die KI die Ausführung genauer eingrenzen.'}
                </p>
              </div>
            )}

            <Card>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                <strong className="text-ink">Was heißt was?</strong>
                <br />
                <strong className="text-ink">Originalteil</strong> kommt mit Herstellerlogo und
                Garantie. <strong className="text-ink">OEM</strong> ist dasselbe Teil vom selben
                Zulieferer, nur ohne Logo – meist die beste Wahl.{' '}
                <strong className="text-ink">Aftermarket</strong> ist ein Nachbau, Qualität
                schwankt je nach Marke. <strong className="text-ink">Gebraucht</strong> lohnt nur
                bei unkritischen Teilen – niemals bei Bremse, Airbag oder Lenkung.
              </p>
            </Card>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
