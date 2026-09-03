import type { RepairJob } from '../types'

/**
 * Selbst machen oder machen lassen?
 *
 * Genau daran entscheidet sich, ob jemand die Anleitung überhaupt anfängt. Die
 * Rechnung ist bewusst einfach und offengelegt: Die Ersatzteile zahlt man in
 * beiden Fällen – gespart wird die Arbeitszeit der Werkstatt. Was übrig bleibt,
 * ist der Gegenwert der eigenen Stunden.
 *
 * Wie `partCost.ts` ohne Netz und ohne KI, damit die Zahl prüfbar bleibt
 * (`npm run test:guide`). Die Arbeitszeit kommt aus `repairJobsFor()` und ist
 * damit schon auf Marke und Fahrzeugart umgerechnet, der Stundensatz aus den
 * Einstellungen des Nutzers.
 */
export interface GuideCostComparison {
  /** Ersatzteile – fallen in beiden Fällen an */
  partsMin: number
  partsMax: number
  /** Arbeitszeit der Werkstatt in Stunden */
  laborHours: number
  laborCost: number
  workshopMin: number
  workshopMax: number
  /** Eigene Kosten: nur das Material */
  diyMin: number
  diyMax: number
  /** Ersparnis = die Arbeitszeit, die man selbst übernimmt */
  saving: number
  /** Eigene Zeit in Minuten */
  ownMinutes: number
  /** Was die eigene Arbeitsstunde damit rechnerisch einbringt */
  savingPerHour?: number
  /** Offengelegte Rechnung für die Anzeige */
  formula: string
}

const euro = (value: number) => `${Math.round(value)} €`

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function guideCostComparison(
  job: Pick<RepairJob, 'laborHours' | 'partsMinEur' | 'partsMaxEur'> | undefined,
  hourlyRateEur: number,
  /** Eigene Dauer in Minuten – aus der Anleitung oder der KI-Einschätzung */
  ownMinutes: number,
): GuideCostComparison | null {
  if (!job) return null

  const rate = positive(hourlyRateEur)
  const hours = positive(job.laborHours)
  // Ohne Arbeitszeit oder ohne Stundensatz gibt es nichts zu vergleichen:
  // Die Ersparnis *ist* die Arbeitszeit der Werkstatt
  if (!rate || !hours) return null

  let partsMin = Math.max(0, Math.round(job.partsMinEur ?? 0))
  let partsMax = Math.max(0, Math.round(job.partsMaxEur ?? 0))
  if (partsMin > partsMax) [partsMin, partsMax] = [partsMax, partsMin]

  const laborCost = Math.round(hours * rate)
  const minutes = positive(ownMinutes) ?? 0
  const savingPerHour = minutes > 0 ? Math.round(laborCost / (minutes / 60)) : undefined

  const parts =
    partsMax > 0
      ? partsMin === partsMax
        ? `Teile ${euro(partsMin)}`
        : `Teile ${euro(partsMin)}–${euro(partsMax)}`
      : 'ohne Material'

  return {
    partsMin,
    partsMax,
    laborHours: hours,
    laborCost,
    workshopMin: partsMin + laborCost,
    workshopMax: partsMax + laborCost,
    diyMin: partsMin,
    diyMax: partsMax,
    saving: laborCost,
    ownMinutes: Math.round(minutes),
    savingPerHour,
    formula: `${parts}  +  ${hours.toLocaleString('de-DE')} h × ${euro(rate)}/h = ${euro(laborCost)} Arbeit`,
  }
}
