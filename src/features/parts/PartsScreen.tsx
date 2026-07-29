import { useMemo, useState } from 'react'
import { Check, Copy, Search, ShoppingCart } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Card, EmptyState, EstimateNote, Input, Segmented, Sheet, cn } from '../../components/ui'
import { PARTS, PART_CATEGORIES } from '../../data/parts'
import { formatEurCents } from '../../lib/format'
import type { Part } from '../../types'

export default function PartsScreen() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof PART_CATEGORIES)[number]>('Alle')
  const [selected, setSelected] = useState<Part | null>(null)
  const [copied, setCopied] = useState(false)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PARTS.filter(
      (p) =>
        (category === 'Alle' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)),
    )
  }, [query, category])

  const copyNumber = async (n: string) => {
    await navigator.clipboard.writeText(n)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Page>
      <PageHeader title="Teile & Preise" backTo="/" />

      <div className="anim-fade-up space-y-4">
        <div className="relative">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Teil suchen…"
            className="pl-10"
          />
        </div>

        <Segmented options={PART_CATEGORIES} value={category} onChange={setCategory} />

        {list.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={26} />}
            title="Kein Teil gefunden"
            text="Versuche einen anderen Suchbegriff, oder frage den KI-Assistenten nach dem passenden Teil für Dein Fahrzeug."
          />
        ) : (
          <div className="space-y-2.5">
            {list.map((p) => {
              const cheapest = p.offers.filter((o) => o.priceEur > 0).sort((a, b) => a.priceEur - b.priceEur)[0]
              const original = p.offers.find((o) => o.quality === 'Originalteil')
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="glass flex w-full items-center gap-3 rounded-[18px] p-3.5 text-left transition active:scale-[.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{p.name}</span>
                    <span className="block truncate font-mono text-[11.5px] text-ink-faint">
                      {p.partNumber}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[15px] font-bold">
                      ab {cheapest ? formatEurCents(cheapest.priceEur) : '—'}
                    </span>
                    {original && (
                      <span className="tnum block text-[11px] text-ink-faint line-through">
                        {formatEurCents(original.priceEur)}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <EstimateNote>
          Preise sind Orientierungswerte aus dem deutschen Teilehandel, keine Live-Abfrage bei Händlern.
          Die Teilenummern gelten für gängige Modelle – prüfe die Passung immer über die
          Fahrgestellnummer Deines Fahrzeugs.
        </EstimateNote>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => copyNumber(selected.partNumber)}
              className="glass flex w-full items-center justify-between gap-3 rounded-xl p-3"
            >
              <span className="text-left">
                <span className="block text-[11.5px] text-ink-faint">Teilenummer</span>
                <span className="block font-mono text-[14px]">{selected.partNumber}</span>
              </span>
              {copied ? (
                <Check size={17} className="text-ok" />
              ) : (
                <Copy size={17} className="text-ink-muted" />
              )}
            </button>

            <div>
              <p className="mb-2 text-[13px] font-semibold">Preisvergleich nach Qualität</p>
              <div className="space-y-2">
                {selected.offers.map((o) => (
                  <div
                    key={o.quality}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl p-3',
                      o.priceEur > 0 ? 'glass' : 'border border-white/6 bg-white/2 opacity-60',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium">{o.quality}</span>
                        {o.quality === 'Originalteil' && <Badge tone="brand">Hersteller</Badge>}
                      </span>
                      {o.note && (
                        <span className="mt-0.5 block text-[11.5px] text-ink-faint">{o.note}</span>
                      )}
                    </span>
                    <span className="tnum shrink-0 text-[15px] font-bold">
                      {o.priceEur > 0 ? formatEurCents(o.priceEur) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Card>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                <strong className="text-ink">Was heißt was?</strong>
                <br />
                <strong className="text-ink">Originalteil</strong> kommt mit Herstellerlogo und
                Garantie. <strong className="text-ink">OEM</strong> ist dasselbe Teil vom selben
                Zulieferer, nur ohne Logo – meist die beste Wahl.{' '}
                <strong className="text-ink">Aftermarket</strong> ist ein Nachbau, Qualität
                schwankt je nach Marke. <strong className="text-ink">Gebraucht</strong> lohnt nur
                bei unkritischen Teilen – niemals bei Bremse, Airbag oder Lenkung.
              </p>
            </Card>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
