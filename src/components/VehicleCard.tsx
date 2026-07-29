import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Vehicle } from '../types'
import { VehicleSilhouette } from './Brand'
import { Badge, cn } from './ui'
import { formatKm } from '../lib/format'

export function VehicleImage({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  if (vehicle.photo) {
    return (
      <img
        src={vehicle.photo}
        alt={`${vehicle.make} ${vehicle.model}`}
        className={cn('object-contain', className)}
      />
    )
  }
  return <VehicleSilhouette kind={vehicle.kind} className={className} />
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
      <VehicleImage vehicle={vehicle} className="h-16 w-[42%] shrink-0" />
      <ChevronRight size={19} className="shrink-0 text-ink-faint" />
    </Link>
  )
}
