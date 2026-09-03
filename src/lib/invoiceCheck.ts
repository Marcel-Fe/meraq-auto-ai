import type { InvoicePosition, RepairJob } from '../types'

/**
 * Ist der Preis auf der Rechnung im üblichen Rahmen?
 *
 * Die Frage stellt sich jeder, der eine Werkstattrechnung in der Hand hält –
 * und keine KI sollte sie beantworten. Gerechnet wird deshalb hier, aus der
 * Werkstattposition für genau dieses Fahrzeug (`repairJobsFor()`, bereits auf
 * Marke und Fahrzeugart umgerechnet) und dem Stundensatz des Nutzers.
 *
 * Die Spanne ist absichtlich großzügig: Eine Werkstatt darf teurer sein als der
 * Durchschnitt, ohne dass die App ihr etwas unterstellt. Erst deutlich darüber
 * wird daraus eine Frage – und auch dann bleibt es eine Frage, kein Urteil.
 *
 * Ohne Netz und ohne KI prüfbar: `npm run test:invoice`.
 */
export type PriceVerdict = 'günstig' | 'im Rahmen' | 'über dem Üblichen' | 'deutlich darüber'

export interface PositionCheck {
  usualMin: number
  usualMax: number
  verdict: PriceVerdict
  /** Offengelegte Rechnung für die Anzeige */
  formula: string
}

const euro = (value: number) => `${Math.round(value).toLocaleString('de-DE')} €`

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function positionPriceCheck(
  position: Pick<InvoicePosition, 'priceEur'>,
  job: Pick<RepairJob, 'laborHours' | 'partsMinEur' | 'partsMaxEur'> | undefined,
  hourlyRateEur: number,
): PositionCheck | null {
  const price = positive(position.priceEur)
  const rate = positive(hourlyRateEur)
  if (!price || !job || !rate) return null

  const hours = Math.max(0, job.laborHours ?? 0)
  const labor = Math.round(hours * rate)
  let partsMin = Math.max(0, Math.round(job.partsMinEur ?? 0))
  let partsMax = Math.max(0, Math.round(job.partsMaxEur ?? 0))
  if (partsMin > partsMax) [partsMin, partsMax] = [partsMax, partsMin]

  const usualMin = partsMin + labor
  const usualMax = partsMax + labor
  if (usualMax <= 0) return null

  // 15 % über der Obergrenze sind noch keine Auffälligkeit: Eine Rechnung enthält
  // Kleinteile, Entsorgung und Mehrwertsteuer, die in der Vorlage nicht stecken
  const verdict: PriceVerdict =
    price < usualMin * 0.8
      ? 'günstig'
      : price <= usualMax * 1.15
        ? 'im Rahmen'
        : price <= usualMax * 1.5
          ? 'über dem Üblichen'
          : 'deutlich darüber'

  const parts =
    partsMax > 0
      ? partsMin === partsMax
        ? `Teile ${euro(partsMin)}`
        : `Teile ${euro(partsMin)}–${euro(partsMax)}`
      : 'ohne Material'

  return {
    usualMin,
    usualMax,
    verdict,
    formula: `${parts}  +  ${hours.toLocaleString('de-DE')} h × ${euro(rate)}/h = ${euro(labor)}`,
  }
}

/**
 * Summe der einzelnen Zeilen. Weicht sie stark von der ausgewiesenen Endsumme
 * ab, fehlt eine Position auf dem Foto – dann darf die App nicht so tun, als
 * hätte sie die ganze Rechnung erklärt.
 */
export function sumOfPositions(positions: Pick<InvoicePosition, 'priceEur'>[]): number {
  return positions.reduce((sum, p) => sum + (positive(p.priceEur) ?? 0), 0)
}

/** Deckt sich die Summe der erklärten Zeilen mit der Endsumme des Belegs? */
export function coversTotal(positions: Pick<InvoicePosition, 'priceEur'>[], totalGrossEur?: number): boolean {
  const total = positive(totalGrossEur)
  const sum = sumOfPositions(positions)
  if (!total || sum === 0) return true
  // Netto-Positionen unter einer Brutto-Endsumme sind der Normalfall (19 % MwSt.),
  // deshalb ist die Spanne nach unten weiter als nach oben
  return sum >= total * 0.75 && sum <= total * 1.1
}
