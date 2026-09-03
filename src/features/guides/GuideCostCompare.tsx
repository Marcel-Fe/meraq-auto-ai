import { ShieldAlert } from 'lucide-react'
import { Card, EstimateNote } from '../../components/ui'
import { formatEur } from '../../lib/format'
import type { GuideCostComparison } from '../../lib/guideCost'

/**
 * „Selbst machen oder machen lassen" – die Frage, an der die Anleitung hängt.
 *
 * Gegenübergestellt wird nur, was sich wirklich unterscheidet: die Arbeitszeit.
 * Das Material zahlt man in beiden Fällen. Die Zeit des Nutzers bleibt bewusst
 * eine Zeitangabe und wird nicht in Euro umgerechnet – wie viel einem der eigene
 * Nachmittag wert ist, entscheidet er selbst.
 */
export function GuideCostCompare({
  cost,
  jobName,
  /** Sicherheitshinweis der Anleitung – dann bleibt der Rat zur Werkstatt sichtbar */
  safety,
  hourlyRate,
}: {
  cost: GuideCostComparison
  jobName: string
  safety?: string
  hourlyRate: number
}) {
  const money = (v: number) => formatEur(v)
  const range = (min: number, max: number) =>
    min === max ? money(min) : `${money(min)} – ${money(max)}`

  return (
    <Card>
      <p className="mb-3 text-[13px] font-semibold text-ink">Selbst machen oder machen lassen?</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] border border-white/8 bg-white/4 p-3">
          <p className="mb-1 text-[11.5px] font-medium text-ink-faint">Werkstatt</p>
          <p className="tnum text-[15px] leading-tight font-semibold text-ink">
            {range(cost.workshopMin, cost.workshopMax)}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {cost.laborHours.toLocaleString('de-DE')} h Arbeit inklusive
          </p>
        </div>

        <div className="rounded-[14px] border border-ok/25 bg-ok/8 p-3">
          <p className="mb-1 text-[11.5px] font-medium text-ink-faint">Selbst</p>
          <p className="tnum text-[15px] leading-tight font-semibold text-ok">
            {cost.diyMax > 0 ? range(cost.diyMin, cost.diyMax) : 'nur Deine Zeit'}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {cost.diyMax > 0 ? 'Material' : 'kein Material'} + {cost.ownMinutes} Min. Deiner Zeit
          </p>
        </div>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
        Du sparst rund <span className="tnum font-semibold text-ink">{money(cost.saving)}</span>{' '}
        Arbeitslohn
        {cost.savingPerHour
          ? ` – das sind etwa ${money(cost.savingPerHour)} für jede Stunde, die Du selbst arbeitest.`
          : '.'}
      </p>

      <p className="mt-1.5 text-[12.5px] text-ink-muted">{cost.formula}</p>

      {safety && (
        <div className="mt-3 rounded-[14px] border border-warn/30 bg-warn/6 p-3">
          <div className="mb-1 flex items-center gap-2 text-warn">
            <ShieldAlert size={14} />
            <span className="text-[12.5px] font-semibold">Geld ist hier nicht das Argument</span>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            Diese Arbeit ist sicherheitsrelevant. Wenn Du beim Ablauf oder beim Drehmoment
            unsicher bist, gehört sie in die Werkstatt – unabhängig davon, was sie kostet.
          </p>
        </div>
      )}

      <EstimateNote>
        Grobe Schätzung auf Basis der Werkstattposition „{jobName}": Arbeitszeit mit Deinem
        Stundensatz ({formatEur(hourlyRate)}/h, änderbar in den Einstellungen), Material zum
        üblichen Handelspreis. Werkzeug ist nicht eingerechnet – das kaufst Du einmal und
        nutzt es danach immer wieder. Was die Werkstatt wirklich verlangt, sagt Dir nur ihr
        Angebot.
      </EstimateNote>
    </Card>
  )
}
