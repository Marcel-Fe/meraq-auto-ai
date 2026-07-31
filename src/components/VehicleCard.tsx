import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Vehicle, VehicleWebImage } from '../types'
import { VehicleSilhouette } from './Brand'
import { Badge, cn } from './ui'
import { formatKm } from '../lib/format'
import { findVehicleImage, imageKey } from '../lib/vehicleImage'
import { useAppStore } from '../store/useAppStore'

/**
 * Besorgt ein frei lizenziertes Foto zum Fahrzeug, wenn der Nutzer kein eigenes
 * hinterlegt hat.
 *
 * Für ein angelegtes Fahrzeug wird das Ergebnis dauerhaft gespeichert – auch ein
 * Misserfolg, damit nicht bei jedem Aufruf erneut gesucht wird. Beim Nachschlagen
 * eines fremden Fahrzeugs gibt es nichts zu speichern; dort wird die Eingabe kurz
 * abgewartet und das Ergebnis nur für die Anzeige gehalten.
 */
export function useVehicleWebImage(vehicle: Vehicle): VehicleWebImage | undefined {
  const enabled = useAppStore((s) => s.settings.webImages)
  const isStored = useAppStore((s) => s.vehicles.some((v) => v.id === vehicle.id))
  const updateVehicle = useAppStore((s) => s.updateVehicle)
  const [local, setLocal] = useState<VehicleWebImage>()
  const key = imageKey(vehicle)

  useEffect(() => {
    if (!enabled || vehicle.photo || !vehicle.make.trim() || !vehicle.model.trim()) return
    if (isStored && (vehicle.webImage || vehicle.webImageChecked)) return

    let active = true
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        findVehicleImage(vehicle, controller.signal).then((image) => {
          if (!active) return
          if (isStored) updateVehicle(vehicle.id, { webImage: image ?? undefined, webImageChecked: true })
          else setLocal(image ?? undefined)
        })
      },
      isStored ? 0 : 700,
    )

    return () => {
      active = false
      controller.abort()
      clearTimeout(timer)
    }
    // Am Modellschlüssel aufgehängt: ein neuer Kilometerstand soll keine neue Suche auslösen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, isStored, vehicle.photo, vehicle.webImage, vehicle.webImageChecked])

  return isStored ? vehicle.webImage : local
}

export function VehicleImage({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const image = useVehicleWebImage(vehicle)

  const src = vehicle.photo ?? image?.dataUrl
  if (src) {
    return (
      <img
        src={src}
        alt={`${vehicle.make} ${vehicle.model}`}
        className={cn('object-contain', className)}
      />
    )
  }
  return <VehicleSilhouette kind={vehicle.kind} className={className} />
}

/**
 * Pflichtangabe zum Foto: freie Lizenzen verlangen Urheber und Lizenz.
 * Wird überall dort gezeigt, wo das Bild groß zu sehen ist.
 */
export function VehicleImageCredit({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const found = useVehicleWebImage(vehicle)
  const image = vehicle.photo ? undefined : found
  if (!image) return null
  return (
    <p className={cn('text-[11px] leading-relaxed text-ink-faint', className)}>
      Foto: {image.author} ·{' '}
      {image.pageUrl ? (
        <a
          href={image.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="text-brand-blue underline-offset-2 hover:underline"
        >
          {image.license}
        </a>
      ) : (
        image.license
      )}{' '}
      · aus {image.articleTitle}. Das Foto zeigt ein Fahrzeug dieser Modellreihe – Baujahr,
      Variante und Ausstattung können abweichen. Ein eigenes Foto ersetzt es jederzeit.
    </p>
  )
}

export function VehicleCard({ vehicle, to = '/vehicle' }: { vehicle: Vehicle; to?: string }) {
  return (
    <Link
      to={to}
      className="glass flex items-center gap-3 rounded-[20px] p-3.5 transition active:scale-[.99]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-ink-faint">Mein Fahrzeug</p>
        <p className="mt-0.5 truncate text-[19px] font-bold text-ink">
          {vehicle.make} {vehicle.model}
        </p>
        <p className="tnum mt-0.5 text-[12.5px] text-ink-muted">
          {vehicle.year} · {formatKm(vehicle.mileage)}
        </p>
        <Badge tone="ok" className="mt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          Daten aktuell
        </Badge>
      </div>
      <VehicleImage vehicle={vehicle} className="h-16 w-[42%] shrink-0 rounded-xl" />
      <ChevronRight size={19} className="shrink-0 text-ink-faint" />
    </Link>
  )
}
