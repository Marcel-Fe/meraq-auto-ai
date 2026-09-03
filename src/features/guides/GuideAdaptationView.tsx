import { AlertTriangle, Clock, ShieldAlert, Sparkles, Wrench } from 'lucide-react'
import { Badge, Card, EstimateNote } from '../../components/ui'
import type { GuideAdaptation } from '../../types'

/**
 * Was an einer allgemeinen Anleitung beim Fahrzeug des Nutzers anders ist.
 *
 * Bewusst ohne die Schritt-Hinweise: die stehen im Screen direkt am jeweiligen
 * Schritt, statt hier noch einmal in einer Liste. Ein Hinweis, den man neben
 * die Arbeit legen kann, ist mehr wert als derselbe Hinweis im Fließtext.
 */
export function GuideAdaptationView({
  adapt,
  vehicleLabel,
}: {
  adapt: GuideAdaptation
  vehicleLabel: string
}) {
  if (!adapt.fits) {
    return (
      <Card className="border-warn/30">
        <div className="mb-1.5 flex items-center gap-2 text-warn">
          <AlertTriangle size={15} />
          <span className="text-[13px] font-semibold">Passt so nicht zu Deinem Fahrzeug</span>
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {adapt.note ?? adapt.summary}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={15} className="text-brand-violet" />
        <span className="text-[13px] font-semibold">Bei {vehicleLabel}</span>
      </div>

      <p className="text-[14px] leading-relaxed text-ink-muted">{adapt.summary}</p>

      {adapt.timeNoviceMin != null && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="brand">
            <Clock size={11} />
            Ungeübt etwa {adapt.timeNoviceMin} Minuten
          </Badge>
        </div>
      )}

      {adapt.specialTools && adapt.specialTools.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-faint">
            <Wrench size={13} />
            Zusätzlich nötig
          </p>
          <ul className="space-y-1.5">
            {adapt.specialTools.map((t) => (
              <li key={t} className="flex gap-2 text-[13.5px] text-ink-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adapt.pitfalls && adapt.pitfalls.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Wo es typischerweise schiefgeht</p>
          <ul className="space-y-1.5">
            {adapt.pitfalls.map((p) => (
              <li key={p} className="flex gap-2 text-[13.5px] text-ink-muted">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adapt.recommendWorkshop && (
        <div className="mt-4 rounded-[14px] border border-danger/30 bg-danger/6 p-3">
          <div className="mb-1 flex items-center gap-2 text-danger">
            <ShieldAlert size={14} />
            <span className="text-[12.5px] font-semibold">Rat: lieber in die Werkstatt</span>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {adapt.workshopReason ?? 'Bei diesem Fahrzeug ist die Arbeit in Eigenregie riskant.'}
          </p>
        </div>
      )}

      {adapt.note && <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">{adapt.note}</p>}

      <EstimateNote>
        Einschätzung der KI für Dein Modell – keine Werksangabe. Drehmomente, Füllmengen und
        Freigaben stehen im Herstellerhandbuch, arbeite nie nach Gefühl.
      </EstimateNote>
    </Card>
  )
}
