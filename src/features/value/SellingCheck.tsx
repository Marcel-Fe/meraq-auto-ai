import { AlertTriangle, CheckCircle2, CircleDashed, Handshake } from 'lucide-react'
import { Card, EstimateNote, SectionTitle } from '../../components/ui'
import { formatEur } from '../../lib/format'
import type { SellingPoint, SellingPointKind } from '../../lib/sellingPrice'

/**
 * Der Verkaufs-Check.
 *
 * Vom Wert führte bisher kein Weg zum Verkauf: Der Screen endete mit der
 * Faktortabelle. Was man beim Termin in der Hand haben sollte, lag verteilt
 * über Wartungsplan, Verlauf, Fehlerspeicher und Dokumente – also nirgends.
 *
 * Hier steht es an einer Stelle: was den Preis belegt, was ihn drückt und was
 * noch fehlt. Keine neue Datenquelle, dieselben Daten wie die Zu- und
 * Abschläge darüber.
 */

const GROUPS: { kind: SellingPointKind; title: string; hint: string }[] = [
  {
    kind: 'proof',
    title: 'Das belegt Deinen Preis',
    hint: 'Sag es von Dir aus, bevor der Käufer fragt.',
  },
  {
    kind: 'drag',
    title: 'Das drückt ihn',
    hint: 'Vorher erledigen bringt meist mehr, als der Käufer dafür abzieht.',
  },
  {
    kind: 'missing',
    title: 'Das fehlt noch',
    hint: 'Jeder Punkt hier macht die Zahl oben genauer.',
  },
]

const STYLE: Record<SellingPointKind, { icon: typeof CheckCircle2; className: string }> = {
  proof: { icon: CheckCircle2, className: 'text-ok' },
  drag: { icon: AlertTriangle, className: 'text-warn' },
  missing: { icon: CircleDashed, className: 'text-ink-faint' },
}

export default function SellingCheck({
  points,
  floor,
}: {
  points: SellingPoint[]
  /** Die Untergrenze aus `sellingFloor()` – hier als merkbare Zahl */
  floor: number
}) {
  return (
    <section>
      <SectionTitle title="Verkaufs-Check" />

      <Card className="mb-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/15 text-brand-teal">
            <Handshake size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] text-ink-faint">Der eine Satz für den Termin</p>
            <p className="tnum mt-0.5 text-[20px] leading-tight font-bold">
              Nicht unter {formatEur(floor)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
          Merk Dir diese eine Zahl, nicht die Spanne. Wer sie im Kopf hat, verhandelt ruhiger –
          und weiß, wann er aufsteht. Die Begründung dafür steht oben unter „Deine
          Preisuntergrenze“.
        </p>
      </Card>

      <div className="space-y-3">
        {GROUPS.map((group) => {
          const list = points.filter((p) => p.kind === group.kind)
          if (!list.length) return null
          const { icon: Icon, className } = STYLE[group.kind]

          return (
            <Card key={group.kind}>
              <p className="text-[13.5px] font-semibold">{group.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{group.hint}</p>

              <div className="mt-3 space-y-3">
                {list.map((p) => (
                  <div key={p.id} className="flex items-start gap-2.5">
                    <Icon size={15} className={`mt-0.5 shrink-0 ${className}`} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{p.title}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-faint">
                        {p.detail}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <EstimateNote>
        Zusammengetragen aus Deinem Wartungsplan, dem Verlauf, dem Fehlerspeicher und den
        Dokumenten – die App erfindet dafür nichts dazu. Je mehr davon gepflegt ist, desto
        belastbarer wird die Untergrenze oben.
      </EstimateNote>
    </section>
  )
}
