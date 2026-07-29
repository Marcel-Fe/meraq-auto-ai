import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info, Plus, Sparkles } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, Segmented, Sheet } from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { manualZonesFor } from '../../data/manual'
import type { ManualHotspot } from '../../types'
import { askClaude, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_ASSISTANT, vehicleContext } from '../../lib/ai/prompts'
import { useActiveVehicle } from '../../store/useAppStore'
import { ZoneScene } from './ZoneScene'

export default function ManualScreen() {
  const vehicle = useActiveVehicle()
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [spot, setSpot] = useState<ManualHotspot | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  // Zonen und Bauteile hängen vom Fahrzeug ab – ein E-Auto hat keinen Ölfilter,
  // ein Motorrad keinen Innenraum
  const zones = useMemo(() => (vehicle ? manualZonesFor(vehicle) : []), [vehicle])

  if (!vehicle || zones.length === 0) return null

  const zone = zones.find((z) => z.id === zoneId) ?? zones[0]

  const askAi = async (hotspot: ManualHotspot) => {
    if (!hasApiKey()) {
      setAnswer('_Für die KI-Vertiefung brauchst Du einen API-Schlüssel (Einstellungen)._')
      return
    }
    setLoading(true)
    setAnswer('')
    let acc = ''
    try {
      await askClaude({
        system: SYSTEM_ASSISTANT,
        context: vehicleContext(vehicle),
        messages: [
          {
            role: 'user',
            content: `Erkläre mir das Bauteil "${hotspot.label}" an meinem Fahrzeug: Wofür ist es da, woran merke ich, dass es defekt ist, und kann ich da selbst etwas machen?`,
          },
        ],
        onText: (d) => {
          acc += d
          setAnswer(acc)
        },
      })
    } catch (err) {
      setAnswer(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Handbuch"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/"
      />

      <div className="anim-fade-up space-y-5">
        <Segmented
          options={zones.map((z) => ({ value: z.id, label: z.label }))}
          value={zone.id}
          onChange={setZoneId}
        />

        <Card padded={false} className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full">
            <ZoneScene scene={zone.scene} />
            {zone.hotspots.map((h) => (
              <button
                key={h.id}
                type="button"
                aria-label={h.label}
                onClick={() => {
                  setSpot(h)
                  setAnswer('')
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
              >
                <span className="relative grid h-8 w-8 place-items-center">
                  <span
                    className="absolute inset-0 rounded-full bg-brand-teal/40"
                    style={{ animation: 'meraq-pulse-ring 2.4s ease-out infinite' }}
                  />
                  <span className="relative grid h-6 w-6 place-items-center rounded-full border border-white/40 bg-brand-teal text-[#04121a] shadow-lg">
                    <Plus size={13} strokeWidth={3} />
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-white/8 px-4 py-3">
            <p className="text-[13px] text-ink-muted">
              {zone.hotspots.length} Bauteile · tippe einen Punkt an
            </p>
          </div>
        </Card>

        <div className="space-y-2">
          {zone.hotspots.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setSpot(h)
                setAnswer('')
              }}
              className="glass flex w-full items-center gap-3 rounded-[15px] px-4 py-3 text-left transition active:scale-[.99]"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-teal/20 text-[11px] font-bold text-brand-teal">
                {zone.hotspots.indexOf(h) + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{h.label}</span>
                <span className="block truncate text-[12px] text-ink-muted">{h.fn}</span>
              </span>
            </button>
          ))}
        </div>

        <EstimateNote>
          <span className="flex items-start gap-2">
            <Info size={13} className="mt-0.5 shrink-0" />
            <span>
              Die Darstellung ist eine schematische Übersicht, kein 3D-Modell Deines konkreten
              Fahrzeugs – dafür gibt es keine frei nutzbaren Herstellerdaten. Positionen und Bauteile
              gelten fahrzeugübergreifend; für exakte Angaben (Drehmomente, Füllmengen) gilt das
              Herstellerhandbuch.
            </span>
          </span>
        </EstimateNote>
      </div>

      <Sheet open={!!spot} onClose={() => setSpot(null)} title={spot?.label}>
        {spot && (
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink-faint">Funktion</p>
              <p className="text-[14px] leading-relaxed text-ink-muted">{spot.fn}</p>
            </div>

            {spot.interval && (
              <Badge tone="brand">Wartung: {spot.interval}</Badge>
            )}

            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Typische Probleme</p>
              <ul className="space-y-1.5">
                {spot.problems.map((p) => (
                  <li key={p} className="flex gap-2 text-[13.5px] text-ink-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {answer ? (
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-violet" />
                  <span className="text-[12.5px] font-semibold">KI-Erklärung</span>
                </div>
                <div className="text-[14px] text-ink-muted">
                  <Markdown text={answer} />
                  {loading && <span className="inline-block animate-pulse">▍</span>}
                </div>
                {!hasApiKey() && (
                  <Link
                    to="/settings"
                    className="mt-2 inline-block text-[13px] font-medium text-brand-blue"
                  >
                    API-Schlüssel eintragen
                  </Link>
                )}
              </Card>
            ) : (
              <Button
                full
                variant="outline"
                loading={loading}
                icon={<Sparkles size={16} />}
                onClick={() => askAi(spot)}
              >
                KI fragen: Was heißt das für mein Fahrzeug?
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </Page>
  )
}
