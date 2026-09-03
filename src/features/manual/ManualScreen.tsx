import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Box, ChevronRight, Crosshair, Info, Layers, Plus, Search, Sparkles } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, Input, Segmented, Sheet, Skeleton } from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { manualZonesFor } from '../../data/manual'
import type { ManualHotspot, PartExplanation } from '../../types'
import { askAi, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_ASSISTANT, vehicleContext } from '../../lib/ai/prompts'
import { explainPart } from '../../lib/partExplain'
import { useActiveVehicle, useAppStore } from '../../store/useAppStore'
import { PartExplanationView } from './PartExplanationView'
import { PartPhoto } from './PartPhoto'
import { ZoneScene } from './ZoneScene'

// Three.js wiegt rund 150 kB gzip – erst laden, wenn die 3D-Ansicht wirklich gezeigt wird
const CarScene3D = lazy(() => import('./CarScene3D'))

/** Kann das Gerät WebGL? Ohne das bleibt es bei der schematischen Zeichnung. */
function hasWebgl() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function ManualScreen() {
  const vehicle = useActiveVehicle()
  const hourlyRate = useAppStore((s) => s.settings.hourlyRateEur)
  const [params, setParams] = useSearchParams()
  const [zoneId, setZoneId] = useState<string | null>(null)
  const [spot, setSpot] = useState<ManualHotspot | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [use3d, setUse3d] = useState(true)
  const [webglReady, setWebglReady] = useState(false)
  const [query, setQuery] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPart, setAiPart] = useState<PartExplanation | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  // Dasselbe für ein hinterlegtes Bauteil im Sheet
  const [spotPart, setSpotPart] = useState<PartExplanation | null>(null)
  const [spotLoading, setSpotLoading] = useState(false)
  const [spotError, setSpotError] = useState('')

  // Erst nach dem ersten Rendern prüfen – auf dem Server gibt es kein document
  useEffect(() => setWebglReady(hasWebgl()), [])

  // Zonen und Bauteile hängen vom Fahrzeug ab – ein E-Auto hat keinen Ölfilter,
  // ein Motorrad keinen Innenraum
  const zones = useMemo(() => (vehicle ? manualZonesFor(vehicle) : []), [vehicle])

  // Gesucht wird über alle Zonen, nicht nur die gerade sichtbare
  const term = query.trim()
  const matches = useMemo(() => {
    const q = term.toLowerCase()
    if (q.length < 2) return []
    return zones
      .flatMap((z) => z.hotspots.map((h) => ({ hotspot: h, zoneId: z.id, zoneLabel: z.label })))
      .filter((m) => m.hotspot.label.toLowerCase().includes(q) || m.hotspot.fn.toLowerCase().includes(q))
      .slice(0, 6)
  }, [zones, term])

  // Einstieg aus Diagnose oder Teilesuche: /manual?teil=<id> öffnet die richtige
  // Zone, wählt das Bauteil aus und richtet die Kamera darauf
  const wantedId = params.get('teil')
  useEffect(() => {
    if (!wantedId) return
    for (const z of zones) {
      const found = z.hotspots.find((h) => h.id === wantedId)
      if (found) {
        setZoneId(z.id)
        setSpot(found)
        setAnswer('')
        break
      }
    }
    // Parameter entfernen, sonst öffnet sich das Sheet nach dem Schließen erneut
    setParams({}, { replace: true })
  }, [wantedId, zones, setParams])

  // Aus der Rechnungserklärung: /manual?bereich=<zone> zeigt den Bereich, wenn
  // die App zum genannten Teil kein eigenes Bauteil kennt (z. B. Querlenker).
  // Kein Sheet – hier gibt es nichts aufzuschlagen, nur etwas zu zeigen.
  const wantedZone = params.get('bereich')
  useEffect(() => {
    if (!wantedZone) return
    if (zones.some((z) => z.id === wantedZone)) setZoneId(wantedZone)
    setParams({}, { replace: true })
  }, [wantedZone, zones, setParams])

  // Beim Wechsel des Bauteils die Erklärung des vorigen wegräumen
  const spotId = spot?.id
  useEffect(() => {
    setSpotPart(null)
    setSpotError('')
  }, [spotId])

  if (!vehicle || zones.length === 0) return null

  const zone = zones.find((z) => z.id === zoneId) ?? zones[0]
  const show3d = use3d && webglReady && zone.hotspots.some((h) => h.pos3d)

  /**
   * Der Weg für alles, was nicht fest hinterlegt ist. Die App kennt gut zwei
   * Dutzend Bauteile – gefragt wird nach allem, vom Radlager bis zum
   * Ladedrucksensor.
   */
  const searchWithAi = async () => {
    if (term.length < 2) return
    setAiOpen(true)
    setAiPart(null)
    setAiError('')
    setAiLoading(true)
    try {
      setAiPart(await explainPart(term, vehicle))
    } catch (err) {
      setAiError(describeAiError(err))
    } finally {
      setAiLoading(false)
    }
  }

  /**
   * Ein hinterlegtes Bauteil auf das Fahrzeug des Nutzers herunterbrechen.
   * Die Daten in `manual.ts` gelten fahrzeugübergreifend – was ein Wechsel bei
   * *diesem* Auto kostet und ob er selbst machbar ist, weiß nur die KI.
   */
  const deepenHotspot = async (hotspot: ManualHotspot) => {
    setSpotError('')
    setSpotLoading(true)
    try {
      setSpotPart(await explainPart(hotspot.label, vehicle))
    } catch (err) {
      setSpotError(describeAiError(err))
    } finally {
      setSpotLoading(false)
    }
  }

  const explainHotspot = async (hotspot: ManualHotspot) => {
    if (!hasApiKey()) {
      setAnswer('_Für die KI-Vertiefung brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen)._')
      return
    }
    setLoading(true)
    setAnswer('')
    let acc = ''
    try {
      await askAi({
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
        {/* Der Foto-Weg ist der genauere: das eigene Fahrzeug statt einer Schemazeichnung */}
        <Link to="/part-finder">
          <Card className="border-brand-teal/30 transition active:scale-[.99]">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-teal/15 text-brand-teal">
                <Crosshair size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">Teil im eigenen Foto finden</span>
                <span className="block text-[12.5px] text-ink-muted">
                  Motorraum fotografieren – die KI markiert die Bauteile im Bild
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-faint" />
            </div>
          </Card>
        </Link>

        {/* Suche über alle Bauteile – was die App nicht kennt, erklärt die KI */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches.length === 0) searchWithAi()
              }}
              placeholder="Bauteil suchen – z. B. Radlager, Zündspule"
              className="pl-10"
              aria-label="Bauteil suchen"
            />
          </div>

          {term.length >= 2 && (
            <div className="space-y-2">
              {matches.map((m) => (
                <button
                  key={m.hotspot.id}
                  type="button"
                  onClick={() => {
                    setZoneId(m.zoneId)
                    setSpot(m.hotspot)
                    setAnswer('')
                  }}
                  className="glass flex w-full items-center gap-3 rounded-[15px] px-4 py-3 text-left transition active:scale-[.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{m.hotspot.label}</span>
                    <span className="block truncate text-[12px] text-ink-muted">{m.zoneLabel}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-faint" />
                </button>
              ))}

              <button
                type="button"
                onClick={searchWithAi}
                className="flex w-full items-center gap-3 rounded-[15px] border border-brand-violet/30 bg-brand-violet/10 px-4 py-3 text-left transition active:scale-[.99]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-violet/20 text-brand-violet">
                  <Sparkles size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">
                    „{term}“ von der KI erklären lassen
                  </span>
                  <span className="block text-[12px] text-ink-muted">
                    {matches.length
                      ? 'Ausführlich, mit Symptomen und Kostenrahmen'
                      : 'Auch seltene Bauteile – passend zu Deinem Fahrzeug'}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>

        <Segmented
          options={zones.map((z) => ({ value: z.id, label: z.label }))}
          value={zone.id}
          onChange={setZoneId}
        />

        <Card padded={false} className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full">
            {show3d ? (
              <Suspense fallback={<div className="skeleton h-full w-full" />}>
                <CarScene3D
                  zone={zone.scene}
                  kind={vehicle.kind}
                  hotspots={zone.hotspots}
                  selectedId={spot?.id}
                  onSelect={(h) => {
                    setSpot(h)
                    setAnswer('')
                  }}
                />
              </Suspense>
            ) : (
              <>
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
              </>
            )}

            {webglReady && (
              <button
                type="button"
                onClick={() => setUse3d(!use3d)}
                className="glass absolute top-2.5 right-2.5 flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold text-ink active:scale-95"
              >
                {show3d ? <Layers size={14} /> : <Box size={14} />}
                {show3d ? '2D' : '3D'}
              </button>
            )}
          </div>
          <div className="border-t border-white/8 px-4 py-3">
            <p className="text-[13px] text-ink-muted">
              {zone.hotspots.length} Bauteile ·{' '}
              {show3d ? 'drehen und zoomen mit dem Finger' : 'tippe einen Punkt an'}
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
            <PartPhoto hotspot={spot} />

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

            {/* Erste Stufe: dieselbe strukturierte Erklärung wie bei der freien
                Suche. Ein hinterlegtes Bauteil darf nicht schlechter erklärt
                werden als ein selbst eingetipptes. */}
            {spotPart ? (
              <div className="border-t border-white/8 pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-violet" />
                  <span className="text-[12.5px] font-semibold">
                    Für Deinen {vehicle.make} {vehicle.model}
                  </span>
                </div>
                <PartExplanationView part={spotPart} hourlyRate={hourlyRate} withFunction={false} />
              </div>
            ) : (
              <Button
                full
                variant="outline"
                loading={spotLoading}
                icon={<Sparkles size={16} />}
                onClick={() => deepenHotspot(spot)}
              >
                Für mein Fahrzeug: Kosten, Symptome, Aufwand
              </Button>
            )}

            {spotError && (
              <div className="space-y-2">
                <p className="text-[13.5px] text-ink-muted">{spotError}</p>
                {!hasApiKey() && (
                  <Link to="/settings" className="inline-block text-[13px] font-medium text-brand-blue">
                    Kostenlos einrichten
                  </Link>
                )}
              </div>
            )}

            {/* Zweite Stufe: freie Nachfrage im Fließtext */}
            {answer ? (
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-violet" />
                  <span className="text-[12.5px] font-semibold">Nachgefragt</span>
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
                    Kostenlos einrichten
                  </Link>
                )}
              </Card>
            ) : (
              spotPart && (
                <Button
                  full
                  variant="ghost"
                  loading={loading}
                  icon={<Sparkles size={16} />}
                  onClick={() => explainHotspot(spot)}
                >
                  Nachfragen: Kann ich das selbst machen?
                </Button>
              )
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={aiOpen} onClose={() => setAiOpen(false)} title={aiPart?.name ?? term}>
        {aiLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {!aiLoading && aiError && (
          <div className="space-y-3">
            <p className="text-[14px] text-ink-muted">{aiError}</p>
            {!hasApiKey() && (
              <Link to="/settings" className="inline-block text-[13.5px] font-medium text-brand-blue">
                Kostenlos einrichten
              </Link>
            )}
          </div>
        )}

        {!aiLoading && aiPart && <PartExplanationView part={aiPart} hourlyRate={hourlyRate} />}
      </Sheet>
    </Page>
  )
}
