import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, ChevronDown, HelpCircle, Image as ImageIcon } from 'lucide-react'
import { Badge, Card, cn } from '../../components/ui'
import { PartPhoto } from '../manual/PartPhoto'
import { formatEur } from '../../lib/format'
import { positionPriceCheck, type PriceVerdict } from '../../lib/invoiceCheck'
import type { InvoicePosition, ManualHotspot, RepairJob } from '../../types'

/**
 * Eine Zeile der Werkstattrechnung, so erklärt, dass ein Laie sie versteht:
 * was es ist, warum es gemacht wurde, wie das Teil aussieht und wo es sitzt.
 *
 * Das Foto wird erst geladen, wenn der Nutzer es aufklappt – eine Rechnung hat
 * schnell sechs Positionen, und jedes Bild ist eine Anfrage an Commons.
 */
const VERDICT_TONE: Record<PriceVerdict, 'ok' | 'neutral' | 'warn'> = {
  günstig: 'ok',
  'im Rahmen': 'ok',
  'über dem Üblichen': 'warn',
  'deutlich darüber': 'warn',
}

const KIND_TONE = {
  Wartung: 'brand',
  Verschleiß: 'neutral',
  Reparatur: 'warn',
  Material: 'neutral',
  Arbeitslohn: 'neutral',
  Sonstiges: 'neutral',
} as const

export function InvoicePositionCard({
  position,
  hotspot,
  job,
  hourlyRate,
}: {
  position: InvoicePosition
  /** Bauteil im Modell, falls die App eines zuordnen konnte */
  hotspot?: ManualHotspot
  /** Vergleichbare Werkstattposition für dieses Fahrzeug */
  job?: RepairJob
  hourlyRate: number
}) {
  const [open, setOpen] = useState(false)
  const check = positionPriceCheck(position, job, hourlyRate)

  /**
   * Die App kennt gut zwei Dutzend Bauteile fest – eine Rechnung nennt auch
   * Querlenker, Radlager oder Spurstangenkopf. Für die baut sie aus dem
   * englischen Suchbegriff der KI ein Behelfs-Bauteil, damit dieselbe
   * Fotosuche greift. Die Id bleibt dabei stabil, sonst wäre der
   * Zwischenspeicher wertlos.
   */
  const shown: ManualHotspot | undefined =
    hotspot ??
    (position.imageQuery
      ? {
          id: `frei:${position.imageQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          label: position.partHint ?? position.label,
          imageQuery: position.imageQuery,
          x: 0,
          y: 0,
          fn: position.plain,
          problems: [],
        }
      : undefined)

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-[14.5px] leading-snug font-semibold text-ink">
          {position.label}
        </p>
        {position.priceEur != null && (
          <p className="tnum shrink-0 text-[14.5px] font-semibold text-ink">
            {formatEur(position.priceEur)}
          </p>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone={KIND_TONE[position.kind]}>{position.kind}</Badge>
        {position.necessity && position.necessity !== 'unklar' && (
          <Badge tone={position.necessity === 'nötig' ? 'warn' : 'neutral'}>
            {position.necessity}
          </Badge>
        )}
        {check && <Badge tone={VERDICT_TONE[check.verdict]}>{check.verdict}</Badge>}
      </div>

      <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">{position.plain}</p>

      {position.why && (
        <div className="mt-3">
          <p className="mb-1 text-[12px] font-semibold text-ink-faint">Warum das gemacht wird</p>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">{position.why}</p>
        </div>
      )}

      {check && (
        <div className="mt-3 rounded-[14px] border border-white/8 bg-white/4 p-3">
          <p className="text-[12.5px] text-ink-muted">
            Üblich für Dein Fahrzeug:{' '}
            <span className="tnum font-semibold text-ink">
              {formatEur(check.usualMin)} – {formatEur(check.usualMax)}
            </span>
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-faint">{check.formula}</p>
          {(check.verdict === 'über dem Üblichen' || check.verdict === 'deutlich darüber') && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-warn">
              <HelpCircle size={13} className="mt-0.5 shrink-0" />
              Das ist kein Vorwurf – frag nach, was in dieser Position steckt. Kleinteile,
              Entsorgung und Anfahrt tauchen oft nicht als eigene Zeile auf.
            </p>
          )}
        </div>
      )}

      {shown && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-[44px] w-full items-center gap-2 text-[13px] font-medium text-brand-blue active:opacity-70"
          >
            <ImageIcon size={15} />
            Wie das Teil aussieht und wo es sitzt
            <ChevronDown
              size={15}
              className={cn('ml-auto transition-transform', open && 'rotate-180')}
            />
          </button>

          {open && (
            <div className="space-y-3 pt-1">
              <PartPhoto hotspot={shown} />

              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {position.location ?? hotspot?.fn}
              </p>

              {hotspot ? (
                <Link
                  to={`/manual?teil=${hotspot.id}`}
                  className="flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-brand-blue"
                >
                  <Box size={15} />
                  Wo sitzt „{hotspot.label}" am Fahrzeug?
                </Link>
              ) : (
                position.zone && (
                  <Link
                    to={`/manual?bereich=${position.zone}`}
                    className="flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-brand-blue"
                  >
                    <Box size={15} />
                    Bereich am Fahrzeug zeigen
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
