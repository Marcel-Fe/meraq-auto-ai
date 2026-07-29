import type { VehicleKind } from '../types'

/**
 * Marken für die Auswahlhilfe beim Anlegen eines Fahrzeugs.
 * Es ist bewusst nur eine Vorschlagsliste – jede beliebige Marke lässt sich
 * frei eintippen, damit auch Nischen- und Oldtimer-Marken funktionieren.
 */
const CAR_BRANDS = [
  'Alfa Romeo', 'Audi', 'BMW', 'Citroën', 'Cupra', 'Dacia', 'DS', 'Fiat', 'Ford', 'Honda',
  'Hyundai', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG',
  'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Polestar', 'Porsche', 'Renault', 'Seat',
  'Škoda', 'Smart', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
]

const MOTORCYCLE_BRANDS = [
  'Aprilia', 'BMW Motorrad', 'Ducati', 'Harley-Davidson', 'Honda', 'Husqvarna', 'Indian',
  'Kawasaki', 'KTM', 'Moto Guzzi', 'MV Agusta', 'Piaggio', 'Royal Enfield', 'Suzuki',
  'Triumph', 'Vespa', 'Yamaha', 'Zero',
]

const TRUCK_BRANDS = ['DAF', 'Iveco', 'MAN', 'Mercedes-Benz', 'Renault Trucks', 'Scania', 'Volvo Trucks']

const BUS_BRANDS = ['Iveco', 'MAN', 'Mercedes-Benz', 'Neoplan', 'Setra', 'Solaris', 'Van Hool']

const VAN_BRANDS = [
  'Citroën', 'Fiat', 'Ford', 'Iveco', 'Maxus', 'Mercedes-Benz', 'Nissan', 'Opel', 'Peugeot',
  'Renault', 'Toyota', 'Volkswagen',
]

const CAMPER_BRANDS = [
  'Adria', 'Bürstner', 'Carado', 'Challenger', 'Dethleffs', 'Hobby', 'Hymer', 'Knaus',
  'Pössl', 'Sunlight', 'Weinsberg', 'Westfalia',
]

export function brandsFor(kind: VehicleKind): string[] {
  switch (kind) {
    case 'motorcycle':
      return MOTORCYCLE_BRANDS
    case 'truck':
      return TRUCK_BRANDS
    case 'bus':
      return BUS_BRANDS
    case 'van':
      return VAN_BRANDS
    case 'camper':
      return CAMPER_BRANDS
    default:
      return CAR_BRANDS
  }
}
