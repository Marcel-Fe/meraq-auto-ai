import type { DtcSeverity } from '../types'

export interface DtcInfo {
  code: string
  title: string
  system: string
  severity: DtcSeverity
  causes: string[]
  /** Grobe Reparaturkostenspanne in Euro */
  costMin: number
  costMax: number
  driveable: 'ja' | 'eingeschränkt' | 'nein'
}

/**
 * Auszug der häufigsten genormten OBD-II-Codes (SAE J2012).
 * Diese Codes sind herstellerübergreifend standardisiert; die Kostenspannen
 * sind Erfahrungswerte und im UI als Schätzung gekennzeichnet.
 * Unbekannte Codes werden über parseDtc() eingeordnet und an die KI übergeben.
 */
export const DTC_DB: DtcInfo[] = [
  {
    code: 'P0300',
    title: 'Zufällige Zündaussetzer erkannt',
    system: 'Motor',
    severity: 'critical',
    causes: ['Zündkerzen verschlissen', 'Zündspule defekt', 'Einspritzdüse verstopft', 'Falschluft im Ansaugtrakt'],
    costMin: 120,
    costMax: 650,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0301',
    title: 'Zündaussetzer Zylinder 1',
    system: 'Motor',
    severity: 'critical',
    causes: ['Zündkerze Zylinder 1', 'Zündspule Zylinder 1', 'Kompressionsverlust'],
    costMin: 90,
    costMax: 500,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0171',
    title: 'Gemisch zu mager (Bank 1)',
    system: 'Gemischaufbereitung',
    severity: 'warn',
    causes: ['Falschluft / undichter Ansaugschlauch', 'Luftmassenmesser verschmutzt', 'Kraftstoffdruck zu niedrig'],
    costMin: 80,
    costMax: 420,
    driveable: 'ja',
  },
  {
    code: 'P0172',
    title: 'Gemisch zu fett (Bank 1)',
    system: 'Gemischaufbereitung',
    severity: 'warn',
    causes: ['Luftfilter zugesetzt', 'Einspritzdüse undicht', 'Lambdasonde träge'],
    costMin: 60,
    costMax: 380,
    driveable: 'ja',
  },
  {
    code: 'P0420',
    title: 'Katalysator-Wirkungsgrad unter Grenzwert (Bank 1)',
    system: 'Abgas',
    severity: 'warn',
    causes: ['Katalysator gealtert', 'Lambdasonde hinter Kat defekt', 'Undichtigkeit in der Abgasanlage'],
    costMin: 250,
    costMax: 1600,
    driveable: 'ja',
  },
  {
    code: 'P0401',
    title: 'AGR-Durchfluss zu gering',
    system: 'Abgasrückführung',
    severity: 'warn',
    causes: ['AGR-Ventil verrußt', 'AGR-Kühler verstopft', 'Unterdruckleitung undicht'],
    costMin: 150,
    costMax: 900,
    driveable: 'ja',
  },
  {
    code: 'P0402',
    title: 'AGR-Durchfluss zu hoch',
    system: 'Abgasrückführung',
    severity: 'warn',
    causes: ['AGR-Ventil hängt offen', 'Steuerventil defekt'],
    costMin: 150,
    costMax: 800,
    driveable: 'ja',
  },
  {
    code: 'P0087',
    title: 'Kraftstoffdruck zu niedrig',
    system: 'Kraftstoffsystem',
    severity: 'critical',
    causes: ['Kraftstofffilter zugesetzt', 'Hochdruckpumpe verschlissen', 'Druckregelventil defekt'],
    costMin: 90,
    costMax: 1400,
    driveable: 'nein',
  },
  {
    code: 'P0299',
    title: 'Turbolader – Ladedruck zu niedrig',
    system: 'Aufladung',
    severity: 'critical',
    causes: ['Ladeluftschlauch undicht', 'Ladedrucksteller/VTG fest', 'Turbolader verschlissen'],
    costMin: 120,
    costMax: 2200,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P2002',
    title: 'Dieselpartikelfilter – Wirkungsgrad zu gering',
    system: 'Abgas',
    severity: 'warn',
    causes: ['DPF beladen (zu viel Kurzstrecke)', 'Differenzdrucksensor defekt', 'DPF am Lebensende'],
    costMin: 180,
    costMax: 2400,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0128',
    title: 'Kühlmitteltemperatur unter Regeltemperatur',
    system: 'Kühlung',
    severity: 'info',
    causes: ['Thermostat hängt offen', 'Kühlmitteltemperatursensor defekt'],
    costMin: 90,
    costMax: 400,
    driveable: 'ja',
  },
  {
    code: 'P0562',
    title: 'Bordspannung zu niedrig',
    system: 'Elektrik',
    severity: 'warn',
    causes: ['Batterie schwach', 'Lichtmaschine/Regler defekt', 'Masseverbindung korrodiert'],
    costMin: 120,
    costMax: 700,
    driveable: 'eingeschränkt',
  },
  {
    code: 'C1234',
    title: 'ABS – Raddrehzahlsensor Signal fehlerhaft',
    system: 'Bremsen / ABS',
    severity: 'critical',
    causes: ['Raddrehzahlsensor defekt', 'Kabelbruch am Radlauf', 'Impulsring beschädigt'],
    costMin: 80,
    costMax: 450,
    driveable: 'eingeschränkt',
  },
  {
    code: 'B1000',
    title: 'Airbag-Steuergerät – interner Fehler',
    system: 'Rückhaltesystem',
    severity: 'critical',
    causes: ['Steuergerät defekt', 'Crashdaten gespeichert', 'Steckverbindung unter dem Sitz gelöst'],
    costMin: 90,
    costMax: 900,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0500',
    title: 'Geschwindigkeitssensor – kein Signal',
    system: 'Antrieb',
    severity: 'warn',
    causes: ['Sensor defekt', 'Kabelbruch', 'Steuergerät-Softwarefehler'],
    costMin: 70,
    costMax: 400,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0011',
    title: 'Nockenwellenverstellung – Position abweichend (Bank 1)',
    system: 'Motorsteuerung',
    severity: 'warn',
    causes: ['Ölstand zu niedrig / Öl verschmutzt', 'Nockenwellenversteller verschlissen', 'Magnetventil defekt'],
    costMin: 90,
    costMax: 1100,
    driveable: 'eingeschränkt',
  },
  {
    code: 'P0016',
    title: 'Kurbel-/Nockenwelle – Korrelationsfehler',
    system: 'Motorsteuerung',
    severity: 'critical',
    causes: ['Steuerkette gelängt', 'Zahnriemen übergesprungen', 'Sensor defekt'],
    costMin: 250,
    costMax: 2500,
    driveable: 'nein',
  },
  {
    code: 'U0100',
    title: 'Kommunikation mit Motorsteuergerät verloren',
    system: 'Bordnetz / CAN',
    severity: 'critical',
    causes: ['CAN-Bus-Leitung unterbrochen', 'Steuergerät ohne Spannung', 'Sicherung defekt'],
    costMin: 80,
    costMax: 1200,
    driveable: 'nein',
  },
]

const SYSTEM_BY_PREFIX: Record<string, string> = {
  P: 'Antrieb / Motor',
  B: 'Karosserie',
  C: 'Fahrwerk',
  U: 'Bordnetz / Kommunikation',
}

export function normalizeDtc(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '')
}

export function isValidDtc(input: string) {
  return /^[PBCU][0-3][0-9A-F]{3}$/.test(normalizeDtc(input))
}

/** Bekannten Code nachschlagen, sonst aus der Codestruktur ableiten */
export function lookupDtc(input: string): DtcInfo | null {
  const code = normalizeDtc(input)
  const known = DTC_DB.find((d) => d.code === code)
  if (known) return known
  if (!isValidDtc(code)) return null
  return {
    code,
    title: 'Unbekannter Fehlercode',
    system: SYSTEM_BY_PREFIX[code[0]] ?? 'Unbekannt',
    severity: 'warn',
    causes: [],
    costMin: 0,
    costMax: 0,
    driveable: 'eingeschränkt',
  }
}

export function searchDtc(query: string): DtcInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return DTC_DB
  return DTC_DB.filter(
    (d) =>
      d.code.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q) ||
      d.system.toLowerCase().includes(q),
  )
}

export const SEVERITY_LABEL: Record<DtcSeverity, string> = {
  info: 'Hinweis',
  warn: 'Beobachten',
  critical: 'Dringend',
}
