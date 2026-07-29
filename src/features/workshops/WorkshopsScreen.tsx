import { useMemo, useState } from 'react'
import { MapPin, Navigation, Phone, Star } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, SectionTitle } from '../../components/ui'
import { WORKSHOPS, distanceKm } from '../../data/workshops'
import { formatEur } from '../../lib/format'

export default function WorkshopsScreen() {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')

  const list = useMemo(() => {
    const withDistance = WORKSHOPS.map((w) => ({
      ...w,
      distanceKm: position ? distanceKm(position.lat, position.lon, w.lat, w.lon) : undefined,
    }))
    return position
      ? withDistance.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      : withDistance.sort((a, b) => b.rating - a.rating)
  }, [position])

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError('Dein Browser unterstützt keine Standortabfrage.')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setLocating(false)
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Standortzugriff wurde abgelehnt. Die Liste bleibt nach Bewertung sortiert.'
            : 'Standort konnte nicht ermittelt werden.',
        )
        setLocating(false)
      },
      { timeout: 8000 },
    )
  }

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
                {position ? 'Nach Entfernung sortiert' : 'Standort freigeben'}
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                {position
                  ? 'Entfernungen sind Luftlinie ab Deinem aktuellen Standort.'
                  : 'Dann werden die Werkstätten nach Entfernung sortiert.'}
              </p>
            </div>
          </div>
          {!position && (
            <Button className="mt-3" full variant="outline" loading={locating} onClick={locate}>
              Standort verwenden
            </Button>
          )}
          {geoError && (
            <p className="mt-3 rounded-xl bg-warn/12 px-3 py-2.5 text-[12.5px] text-warn">
              {geoError}
            </p>
          )}
        </Card>

        <section>
          <SectionTitle title="Werkstätten" action={`${list.length}`} />
          <div className="space-y-2.5">
            {list.map((w) => (
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
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {w.specialties.map((s) => (
                        <Badge key={s}>{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={`tel:${w.phone.replace(/\s/g, '')}`}>
                    <Button size="sm" full icon={<Phone size={15} />}>
                      Anrufen
                    </Button>
                  </a>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${w.lat}&mlon=${w.lon}#map=16/${w.lat}/${w.lon}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="sm" full variant="outline" icon={<MapPin size={15} />}>
                      Karte
                    </Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <EstimateNote>
          Diese Liste ist ein Beispieldatensatz zur Demonstration – es sind keine echten Betriebe.
          Für eine echte Umkreissuche mit Öffnungszeiten und Bewertungen braucht es eine
          Karten-Schnittstelle (z. B. Google Places oder Overpass), die in einer späteren Version
          angebunden werden kann.
        </EstimateNote>
      </div>
    </Page>
  )
}
