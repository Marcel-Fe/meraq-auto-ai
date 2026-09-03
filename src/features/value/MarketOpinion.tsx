import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Minus, Plus, Sparkles, Store, TrendingUp } from 'lucide-react'
import { Badge, Button, Card, EstimateNote } from '../../components/ui'
import { describeAiError, hasApiKey } from '../../lib/ai/client'
import { askMarketValue, cachedOpinion, compareToOwn } from '../../lib/marketValue'
import { formatEur } from '../../lib/format'
import type { MarketOpinion, Vehicle } from '../../types'

/**
 * Die zweite Meinung neben der eigenen Rechnung.
 *
 * Die Hauptzahl bleibt oben und bleibt gerechnet. Hier steht, was eine Formel
 * nicht wissen kann: wie gefragt die Baureihe ist, was ihren Preis hebt und
 * wie lange ein Verkauf dauert. Weicht die Schätzung stark ab, sagt die App
 * das – zwei Zahlen nebeneinander ohne Einordnung sind schlechter als eine.
 */
export default function MarketOpinionSection({
  vehicle,
  ownPrivateSale,
}: {
  vehicle: Vehicle
  ownPrivateSale: number
}) {
  const [opinion, setOpinion] = useState<MarketOpinion | undefined>(() => cachedOpinion(vehicle))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Der Zwischenspeicher hängt an Fahrzeug, Kilometerstand und Zustand –
  // ändert sich einer davon, passt die alte Einschätzung nicht mehr
  useEffect(() => {
    setOpinion(cachedOpinion(vehicle))
    setError('')
  }, [vehicle])

  const load = async () => {
    if (!hasApiKey()) {
      setError(
        'Dafür brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos. Du hinterlegst ihn in den Einstellungen.',
      )
      return
    }
    setLoading(true)
    setError('')
    try {
      setOpinion(await askMarketValue(vehicle, ownPrivateSale))
    } catch (err) {
      setError(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  const comparison = opinion ? compareToOwn(ownPrivateSale, opinion) : null
  const tone =
    comparison?.state === 'deckt sich'
      ? 'ok'
      : comparison?.state === 'KI niedriger'
        ? 'warn'
        : comparison?.state === 'KI höher'
          ? 'brand'
          : 'neutral'

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-violet/15 text-brand-violet">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Zweite Meinung zum Preis</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">
            Was eine Formel nicht weiß: wie gefragt genau diese Baureihe ist.
          </p>
        </div>
      </div>

      {!opinion && (
        <>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
            Die Rechnung oben kennt Neupreis, Alter, Kilometer und Zustand. Ausstattung,
            Nachfrage und der Ruf der Baureihe fehlen ihr. Genau danach fragen wir die KI – die
            Einschätzung steht dann neben unserer Zahl, nicht an ihrer Stelle.
          </p>
          <Button className="mt-3 w-full" onClick={load} disabled={loading}>
            {loading ? 'Wird eingeschätzt …' : 'Einschätzung holen'}
          </Button>
        </>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-warn/25 bg-warn/10 px-3 py-2.5 text-[12px] leading-relaxed text-warn">
          {error}{' '}
          <Link to="/settings" className="font-semibold underline">
            Einstellungen öffnen
          </Link>
        </p>
      )}

      {opinion && comparison && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone}>{comparison.state}</Badge>
            <Badge tone={opinion.certainty === 'gut bekannt' ? 'ok' : 'neutral'}>
              Baureihe {opinion.certainty}
            </Badge>
            <Badge tone={opinion.demand === 'gering' ? 'warn' : opinion.demand === 'hoch' ? 'ok' : 'neutral'}>
              Nachfrage {opinion.demand}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[16px] bg-white/4 p-3">
              <p className="text-[11px] text-ink-faint">Unsere Rechnung</p>
              <p className="tnum mt-1 text-[17px] font-bold">{formatEur(ownPrivateSale)}</p>
            </div>
            <div className="rounded-[16px] bg-white/4 p-3">
              <p className="text-[11px] text-ink-faint">KI-Einschätzung</p>
              <p className="tnum mt-1 text-[17px] font-bold">
                {opinion.privateMinEur && opinion.privateMaxEur
                  ? `${formatEur(opinion.privateMinEur)} – ${formatEur(opinion.privateMaxEur)}`
                  : 'keine Spanne'}
              </p>
            </div>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-muted">{comparison.text}</p>

          {(opinion.priceUp.length > 0 || opinion.priceDown.length > 0) && (
            <div className="space-y-2">
              {opinion.priceUp.map((p) => (
                <p key={p} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                  <Plus size={13} className="mt-0.5 shrink-0 text-ok" />
                  {p}
                </p>
              ))}
              {opinion.priceDown.map((p) => (
                <p key={p} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                  <Minus size={13} className="mt-0.5 shrink-0 text-warn" />
                  {p}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-white/8 pt-3">
            {opinion.demandNote && (
              <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                <TrendingUp size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                {opinion.demandNote}
              </p>
            )}
            {opinion.timeToSell && (
              <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                <Clock size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                Verkaufsdauer: {opinion.timeToSell}
              </p>
            )}
            {opinion.bestChannel && (
              <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                <Store size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                {opinion.bestChannel}
              </p>
            )}
          </div>

          {opinion.note && (
            <p className="text-[11.5px] leading-relaxed text-ink-faint">{opinion.note}</p>
          )}

          <EstimateNote>
            Diese Spanne ist eine Einschätzung aus Erfahrungswissen – die App fragt keine
            Fahrzeugbörse ab und hat keine Marktdatenbank. Die Hauptzahl bleibt die offengelegte
            Rechnung oben; die Untergrenze richtet sich nach ihr, nicht nach dieser Schätzung.
          </EstimateNote>
        </div>
      )}
    </Card>
  )
}
