import { AlertTriangle, Wrench } from 'lucide-react'
import { Badge, Card, EstimateNote } from '../../components/ui'
import { partCostEstimate } from '../../lib/partCost'
import { formatEur } from '../../lib/format'
import type { PartExplanation } from '../../types'

/**
 * Die KI-Erklärung zu einem Bauteil – für gesuchte wie für hinterlegte.
 *
 * Beide Wege zeigen dasselbe: Ein Bauteil, das die App kennt, darf nicht
 * schlechter erklärt werden als eines, das der Nutzer selbst eingetippt hat.
 * Deshalb steht die Darstellung hier für sich und nicht zweimal im Screen.
 *
 * Der Kostenrahmen wird gerechnet, nicht übernommen: Die KI liefert
 * Ersatzteilspanne und Arbeitszeit, den Stundensatz kennt nur die App.
 */
export function PartExplanationView({
  part,
  hourlyRate,
  /** Bei hinterlegten Bauteilen steht die Funktion schon im Sheet darüber */
  withFunction = true,
}: {
  part: PartExplanation
  hourlyRate: number
  withFunction?: boolean
}) {
  const cost = part.exists ? partCostEstimate(part, hourlyRate) : null

  if (!part.exists) {
    return (
      <Card className="border-warn/30">
        <div className="mb-1.5 flex items-center gap-2 text-warn">
          <AlertTriangle size={15} />
          <span className="text-[13px] font-semibold">Gibt es an Deinem Fahrzeug nicht</span>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {part.note ?? `${part.name} kommt bei diesem Antrieb nicht vor.`}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone={part.effort === 'Werkstatt' ? 'warn' : 'brand'}>
          <Wrench size={11} className="mr-1 inline" />
          {part.effort}
        </Badge>
        {part.interval && <Badge tone="brand">Wartung: {part.interval}</Badge>}
      </div>

      {withFunction && (
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-faint">Funktion</p>
          <p className="text-[14px] leading-relaxed text-ink-muted">{part.fn}</p>
        </div>
      )}

      {part.location && (
        <div>
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-faint">Wo es sitzt</p>
          <p className="text-[14px] leading-relaxed text-ink-muted">{part.location}</p>
        </div>
      )}

      {part.symptoms.length > 0 && (
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Woran Du einen Defekt merkst</p>
          <ul className="space-y-1.5">
            {part.symptoms.map((s) => (
              <li key={s} className="flex gap-2 text-[13.5px] text-ink-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {part.checks && part.checks.length > 0 && (
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Das kannst Du selbst prüfen</p>
          <ul className="space-y-1.5">
            {part.checks.map((c) => (
              <li key={c} className="flex gap-2 text-[13.5px] text-ink-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cost && (
        <Card>
          <p className="mb-1 text-[12.5px] font-semibold text-ink-faint">Was ein Wechsel etwa kostet</p>
          {cost.totalMin !== undefined && cost.totalMax !== undefined ? (
            <p className="tnum text-[19px] font-semibold">
              {formatEur(cost.totalMin)} – {formatEur(cost.totalMax)}
            </p>
          ) : (
            <p className="text-[13.5px] text-ink-muted">Nur ein Teil der Rechnung ist bekannt – siehe unten.</p>
          )}
          <p className="mt-1 text-[12.5px] text-ink-muted">{cost.formula}</p>
          <EstimateNote>
            Grobe Schätzung: Ersatzteilspanne aus der KI-Einschätzung für Dein Fahrzeug, dazu die
            Arbeitszeit mit Deinem Stundensatz ({formatEur(hourlyRate)}/h, änderbar in den
            Einstellungen). Was die Werkstatt wirklich verlangt, sagt Dir nur ihr Angebot.
          </EstimateNote>
        </Card>
      )}

      {part.safetyNote && (
        <Card className="border-danger/30">
          <div className="mb-1.5 flex items-center gap-2 text-danger">
            <AlertTriangle size={15} />
            <span className="text-[13px] font-semibold">Sicherheit</span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">{part.safetyNote}</p>
        </Card>
      )}

      {part.note && <p className="text-[12.5px] leading-relaxed text-ink-faint">{part.note}</p>}
    </div>
  )
}
