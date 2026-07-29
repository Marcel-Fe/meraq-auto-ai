import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Clock, Search, Wrench } from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, EmptyState, EstimateNote, Input, Segmented } from '../../components/ui'
import { GUIDES, GUIDE_CATEGORIES } from '../../data/guides'

const DIFFICULTY_TONE = {
  einfach: 'ok',
  mittel: 'warn',
  schwer: 'danger',
} as const

export default function GuidesScreen() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof GUIDE_CATEGORIES)[number]>('Alle')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GUIDES.filter(
      (g) =>
        (category === 'Alle' || g.category === category) &&
        (!q || g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)),
    )
  }, [query, category])

  return (
    <Page>
      <PageHeader title="Anleitungen" backTo="/" />

      <div className="anim-fade-up space-y-4">
        <div className="relative">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche in Anleitungen…"
            className="pl-10"
          />
        </div>

        <Segmented options={GUIDE_CATEGORIES} value={category} onChange={setCategory} />

        {list.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={26} />}
            title="Keine Anleitung gefunden"
            text="Frag den KI-Assistenten – er kann Dir jeden Arbeitsschritt für Dein Fahrzeug erklären."
          />
        ) : (
          <div className="space-y-2.5">
            {list.map((g) => (
              <Link
                key={g.id}
                to={`/guides/${g.id}`}
                className="glass flex items-center gap-3 rounded-[18px] p-3.5 transition active:scale-[.99]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/6 text-brand-teal">
                  <Wrench size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{g.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <Badge tone={DIFFICULTY_TONE[g.difficulty]}>{g.difficulty}</Badge>
                    <span className="tnum flex items-center gap-1 text-[11.5px] text-ink-faint">
                      <Clock size={11} />
                      {g.durationMin} Min
                    </span>
                    <span className="text-[11.5px] text-ink-faint">
                      {g.steps.length} Schritte
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}

        <EstimateNote>
          Die Anleitungen sind fahrzeugübergreifend formuliert. Genaue Drehmomente, Füllmengen und
          Ölfreigaben stehen im Herstellerhandbuch – arbeite nie nach Gefühl. Bei Bremsen, Lenkung und
          Airbag gilt: im Zweifel Werkstatt.
        </EstimateNote>
      </div>
    </Page>
  )
}
