import type { PartExplanation } from '../types'

/**
 * Kostenrahmen zu einem erklärten Bauteil.
 *
 * Bewusst getrennt vom KI-Aufruf und ohne Netz: Die Rechnung ist der Teil, den
 * der Nutzer sieht und dem er glauben soll – sie muss prüfbar sein
 * (`npm run test:part`).
 *
 * Aufgeteilt wird wie im Reparaturkosten-Screen: Ersatzteil-Spanne von der KI
 * (die kennt das Fahrzeug), Arbeitszeit × Stundensatz des Nutzers. Die App
 * rechnet den Stundensatz selbst dazu, statt die KI eine Endsumme raten zu
 * lassen – sonst stünde neben dem eingestellten Satz eine fremde Zahl.
 */
export interface PartCostEstimate {
  partsMin?: number
  partsMax?: number
  laborHours?: number
  laborCost?: number
  totalMin?: number
  totalMax?: number
  /** Offengelegte Rechnung für die Anzeige */
  formula: string
}

const euro = (value: number) => `${Math.round(value)} €`

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function partCostEstimate(
  part: Pick<PartExplanation, 'partCostMinEur' | 'partCostMaxEur' | 'laborHours'>,
  hourlyRateEur: number,
): PartCostEstimate | null {
  const rate = positive(hourlyRateEur) ?? 0
  let partsMin = positive(part.partCostMinEur)
  let partsMax = positive(part.partCostMaxEur)
  // Eine einzelne Zahl ist als Spanne genauso brauchbar – vertauschte Grenzen nicht
  if (partsMin && partsMax && partsMin > partsMax) [partsMin, partsMax] = [partsMax, partsMin]
  if (partsMin && !partsMax) partsMax = partsMin
  if (partsMax && !partsMin) partsMin = partsMax

  // Über 12 Stunden ist keine Position mehr, sondern ein Missverständnis der KI
  const laborHours = positive(part.laborHours)
  const hours = laborHours && laborHours <= 12 ? laborHours : undefined
  const laborCost = hours && rate ? Math.round(hours * rate) : undefined

  if (partsMin === undefined && laborCost === undefined) return null

  const totalMin = partsMin !== undefined && laborCost !== undefined ? partsMin + laborCost : undefined
  const totalMax = partsMax !== undefined && laborCost !== undefined ? partsMax + laborCost : undefined

  const parts: string[] = []
  if (partsMin !== undefined && partsMax !== undefined) {
    parts.push(partsMin === partsMax ? `Teil ${euro(partsMin)}` : `Teil ${euro(partsMin)}–${euro(partsMax)}`)
  }
  if (hours !== undefined && laborCost !== undefined) {
    parts.push(`${hours.toLocaleString('de-DE')} h × ${euro(rate)}/h = ${euro(laborCost)}`)
  }

  return {
    partsMin,
    partsMax,
    laborHours: hours,
    laborCost,
    totalMin,
    totalMax,
    formula: parts.join('  +  '),
  }
}
