import { useMemo, useRef, useState } from 'react'
import { Clock, Globe, MapPin, Navigation, Phone, RefreshCw, Star } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EmptyState, EstimateNote, SectionTitle, Segmented, cn } from '../../components/ui'
import { WORKSHOPS, distanceKm } from '../../data/workshops'
import {
  OSM_ATTRIBUTION,
  SHOP_LABELS,
  searchWorkshops,
  shopTypesFor,
} from '../../lib/workshopSearch'
import { useActiveVehicle, useAppStore } from '../../store/useAppStore'
import { formatEur, formatRelative } from '../../lib/format'
import { todayIso } from '../../lib/format'

const RADIUS_OPTIONS = [
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
]

export default function WorkshopsScreen() {
  const vehicle = useActiveVehicle()
  const cached = useAppStore((s) => s.workshopSearch)
  const setWorkshopSearch = useAppStore((s) => s.setWorkshopSearch)

  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(
    cached ? { lat: cached.lat, lon: cached.lon } : null,
  )
  const [radius, setRadius] = useState(String(cached?.radiusKm ?? 10))
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const results = cached?.results ?? null

  const demoList = useMemo(
    () =>
      WORKSHOPS.map((w) => ({
        ...w,
        distanceKm: position ? distanceKm(position.lat, position.lon, w.lat, w.lon) : undefined,
      })).sort((a, b) =>
        position ? (a.distanceKm ?? 0) - (b.distanceKm ?? 0) : b.rating - a.rating,
      ),
    [position],
  )

  const run = async (at: { lat: number; lon: number }, radiusKm: number) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)
    setError('')
    try {
      const found = await searchWorkshops({
        lat: at.lat,
        lon: at.lon,
        radiusKm,
        vehicle,
        signal: controller.signal,
      })
      setWorkshopSearch({ at: todayIso(), lat: at.lat, lon: at.lon, radiusKm, results: found })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Die Suche hat nicht geklappt.')
    } finally {
      setSearching(false)
      abortRef.current = null
    }
  }

  const locateAndSearch = () => {
    if (!navigator.geolocation) {
      setError('Dein Browser unterstützt keine Standortabfrage. Ohne Standort gibt es keine Umkreissuche.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setPosition(at)
        setLocating(false)
        void run(at, Number(radius))
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Standortzugriff wurde abgelehnt. Für die Umkreissuche brauchst Du ihn – unten stehen so lange Beispielbetriebe.'
            : 'Standort konnte nicht ermittelt werden.',
        )
        setLocating(false)
      },
      { timeout: 8000, maximumAge: 300_000 },
    )
  }

  const changeRadius = (value: string) => {
    setRadius(value)
    if (position) void run(position, Number(value))
  }

  const busy = locating || searching

  return (
    <Page>
      <PageHeader title="Werkstatt finden" backTo="/" />

      <div className="anim-fade-up space-y-5">
        <Card>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue/15 text-brand-blue">
              <Navigation size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">
                {results ? 'Betriebe in Deiner Nähe' : 'Standort freigeben'}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                {results
                  ? `${results.length} Treffer im Umkreis von ${cached?.radiusKm} km · zuletzt gesucht ${formatRelative(cached?.at)}`
                  : 'Dann sucht die App echte Werkstätten in Deiner Umgebung – aus OpenStreetMap, nicht erfunden.'}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2.5">
            <Segmented options={RADIUS_OPTIONS} value={radius} onChange={changeRadius} />
            <Button
              full
              variant={results ? 'outline' : 'primary'}
              loading={busy}
              onClick={position ? () => run(position, Number(radius)) : locateAndSearch}
              icon={results ? <RefreshCw size={16} /> : <Navigation size={16} />}
            >
              {busy
                ? locating
                  ? 'Standort wird ermittelt…'
                  : 'Suche läuft…'
                : results
                  ? 'Erneut suchen'
                  : 'Werkstätten in der Nähe suchen'}
            </Button>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-warn/12 px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
              {error}
            </p>
          )}
        </Card>

        {vehicle && (
          <p className="px-1 text-[12px] text-ink-faint">
            Gesucht wird nach{' '}
            {shopTypesFor(vehicle)
              .map((t) => SHOP_LABELS[t] ?? t)
              .join(', ')}{' '}
            – passend zu Deinem {vehicle.make} {vehicle.model}.
          </p>
        )}

        {results ? (
          <section>
            <SectionTitle title="Gefundene Betriebe" action={`${results.length}`} />
            {results.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<MapPin size={22} />}
                  title="Keine Betriebe im Umkreis"
                  text="In OpenStreetMap ist hier nichts Passendes eingetragen. Vergrößere den Umkreis – auf dem Land sind 25 km oft nötig."
                />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {results.map((w) => (
                  <Card key={w.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[15px] font-semibold">{w.name}</p>
                      <span className="tnum shrink-0 text-[12.5px] text-ink-muted">
                        {w.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                    {(w.street || w.city) && (
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {[w.street, w.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{SHOP_LABELS[w.kind] ?? w.kind}</Badge>
                      {w.openingHours && (
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-faint">
                          <Clock size={11} />
                          {w.openingHours}
                        </span>
                      )}
                    </div>
                    {/* Ohne Kontaktweg nimmt die Karte die volle Breite – ein
                        Platzhalter an dieser Stelle sähe aus wie ein kaputter Knopf */}
                    <div className={cn('mt-3 grid gap-2', (w.phone || w.website) && 'grid-cols-2')}>
                      {w.phone ? (
                        <a href={`tel:${w.phone.replace(/\s/g, '')}`}>
                          <Button size="sm" full icon={<Phone size={15} />}>
                            Anrufen
                          </Button>
                        </a>
                      ) : w.website ? (
                        <a href={w.website} target="_blank" rel="noreferrer">
                          <Button size="sm" full variant="outline" icon={<Globe size={15} />}>
                            Website
                          </Button>
                        </a>
                      ) : null}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${w.lat}&mlon=${w.lon}#map=17/${w.lat}/${w.lon}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" full variant="outline" icon={<MapPin size={15} />}>
                          Auf der Karte zeigen
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section>
            <SectionTitle title="Beispielbetriebe" />
            <p className="mb-3 px-1 text-[12px] leading-relaxed text-ink-faint">
              Bis Du gesucht hast, stehen hier erfundene Beispiele – erkennbar an den
              Fantasienamen. Sie zeigen nur, wie die Liste aussieht.
            </p>
            <div className="space-y-2.5">
              {demoList.map((w) => (
                <Card key={w.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{w.name}</p>
                      <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                        {w.street}, {w.city}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 text-[12.5px] font-medium text-warn">
                          <Star size={12} fill="currentColor" />
                          {w.rating.toFixed(1)}
                          <span className="text-ink-faint">({w.reviews})</span>
                        </span>
                        {w.distanceKm != null && (
                          <span className="tnum flex items-center gap-1 text-[12.5px] text-ink-muted">
                            <MapPin size={12} />
                            {w.distanceKm.toFixed(1)} km
                          </span>
                        )}
                        <span className="tnum text-[12.5px] text-ink-muted">
                          {formatEur(w.hourlyRateEur)}/h
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <EstimateNote>
          {results ? (
            <>
              Die Betriebe stammen aus OpenStreetMap – echte Einträge, aber von Freiwilligen
              gepflegt: Öffnungszeiten und Telefonnummern können veraltet sein, und wer nicht
              eingetragen ist, taucht nicht auf. Ruf vorher an. Bewertungen und Stundensätze zeigt
              die App bewusst nicht – die stehen nicht in den Daten und wären erfunden.
              Entfernungen sind Luftlinie. {OSM_ATTRIBUTION}.
            </>
          ) : (
            <>
              Die Suche fragt OpenStreetMap ab – einen kostenlosen Gemeinschaftsdienst ohne
              Verfügbarkeitszusage. Bei Überlastung hilft ein zweiter Versuch nach kurzer Wartezeit.
              Die Beispielbetriebe oben sind erfunden und dienen nur der Darstellung.
            </>
          )}
        </EstimateNote>
      </div>
    </Page>
  )
}
