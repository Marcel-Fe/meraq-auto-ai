import type { ActivityEntry, DiagnosisEntry, Vehicle } from '../types'

export const DEMO_VEHICLE_ID = 'demo-bmw-320d'

/** Das Fahrzeug aus den Original-Mockups – dient als Startpunkt und Beispiel. */
export const demoVehicle: Vehicle = {
  id: DEMO_VEHICLE_ID,
  kind: 'car',
  make: 'BMW',
  model: '320d',
  variant: 'G20 Limousine',
  year: 2019,
  mileage: 68_540,
  mileageUpdatedAt: new Date().toISOString(),
  vin: 'WBA8E510X0K1234567',
  plate: 'M-BR 6156',
  fuel: 'Diesel',
  transmission: 'Automatik',
  powerKw: 140,
  bodyType: 'Limousine',
  firstRegistration: '2019-04-18',
  huDue: '2026-07-31',
  condition: 'gut',
  listPriceNew: 46_500,
  color: 'Saphirschwarz',
  createdAt: '2024-01-15T10:00:00.000Z',
  // Angaben aus dem Fahrzeugschein – damit die Steuer- und Kostenrechnung
  // im Beispiel sofort echte Zahlen liefert statt nur Platzhalter
  displacementCcm: 1_995,
  co2GramPerKm: 124,
  consumption: 5.4,
  annualKm: 15_000,
}

export function demoActivities(vehicleId: string): ActivityEntry[] {
  return [
    {
      id: 'act-1',
      vehicleId,
      date: monthsAgo(2),
      title: 'Ölwechsel durchgeführt',
      detail: 'bei 59.600 km · 5W-30 Longlife',
      icon: 'oil',
      costEur: 189,
      mileage: 59_600,
    },
    {
      id: 'act-2',
      vehicleId,
      date: monthsAgo(3),
      title: 'Neue Rechnung hinzugefügt',
      detail: 'Bremsbeläge vorne',
      icon: 'invoice',
      costEur: 512,
    },
    {
      id: 'act-3',
      vehicleId,
      date: monthsAgo(4),
      title: 'Fehlerdiagnose durchgeführt',
      detail: 'Keine Fehlercodes gefunden',
      icon: 'diagnosis',
    },
    {
      id: 'act-4',
      vehicleId,
      date: monthsAgo(5),
      title: 'Kilometerstand aktualisiert',
      detail: '55.200 km',
      icon: 'mileage',
      mileage: 55_200,
    },
    {
      id: 'act-5',
      vehicleId,
      date: monthsAgo(7),
      title: 'Inspektion beim Partner',
      detail: 'Ölservice + Sichtprüfung',
      icon: 'repair',
      costEur: 349,
    },
  ]
}

export function demoDiagnoses(vehicleId: string): DiagnosisEntry[] {
  return [
    {
      id: 'diag-1',
      vehicleId,
      date: monthsAgo(4),
      code: '—',
      title: 'Komplettprüfung: keine Fehlercodes',
      severity: 'info',
      system: 'Gesamtfahrzeug',
      resolved: true,
    },
  ]
}

function monthsAgo(m: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - m)
  return d.toISOString()
}

/** Systeme für die Ampel-Übersicht auf dem Diagnose-Screen */
export const MONITORED_SYSTEMS = [
  'Motor',
  'Getriebe',
  'ABS',
  'Airbag',
  'Elektronik',
  'Abgas',
  'Klima',
  'Bordnetz',
] as const
