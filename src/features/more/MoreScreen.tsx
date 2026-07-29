import { useMemo, useState } from 'react'
import {
  BadgeEuro,
  BellRing,
  BookOpen,
  Box,
  Calculator,
  CircleHelp,
  Crosshair,
  Droplet,
  FileSpreadsheet,
  FileText,
  Gauge,
  HelpCircle,
  MapPin,
  PiggyBank,
  Receipt,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { HomeHeader, Page } from '../../app/AppShell'
import { Card, EstimateNote, Row, RowGroup, SectionTitle, Sheet } from '../../components/ui'
import { useActiveVehicle, useVehicleActivities } from '../../store/useAppStore'
import { formatDate, formatEur, formatRelative } from '../../lib/format'

const ACTIVITY_ICONS = {
  oil: Droplet,
  invoice: Receipt,
  diagnosis: Stethoscope,
  reminder: BellRing,
  document: FileText,
  mileage: Gauge,
  repair: Wrench,
}

const INFO_TOPICS: Record<string, { title: string; body: string }> = {
  insurance: {
    title: 'Versicherungen',
    body: `Die Kfz-Haftpflicht ist Pflicht, Teil- und Vollkasko freiwillig.

Faustregel: Vollkasko lohnt in den ersten vier bis fünf Jahren, danach meist Teilkasko. Ein Wechsel ist normalerweise zum 30. November zum Jahresende möglich; nach einer Beitragserhöhung oder einem Schaden gilt ein Sonderkündigungsrecht.

Was den Beitrag senkt: höhere Selbstbeteiligung, Werkstattbindung, Garagenstellplatz, geringe Jahresfahrleistung und ein guter Schadenfreiheitsrabatt.

Lege Deine Police unter Dokumente ab und trage das Ablaufdatum ein – dann erinnert Dich die App rechtzeitig.`,
  },
  tax: {
    title: 'Steuern & Abgaben',
    body: `Die Kfz-Steuer richtet sich bei Pkw nach Hubraum und CO₂-Ausstoß.

Grob: je 100 cm³ Hubraum 2,00 € (Benzin) bzw. 9,50 € (Diesel) pro Jahr, plus ein CO₂-Anteil für alles über 95 g/km. Reine Elektrofahrzeuge sind bis Ende 2030 von der Steuer befreit, wenn sie bis Ende 2025 zugelassen wurden.

Den exakten Betrag berechnet der Kfz-Steuer-Rechner des Zolls – der ist verbindlich, jede App-Schätzung nicht.`,
  },
  hu: {
    title: 'HU / AU-Termine',
    body: `Neuwagen müssen nach 36 Monaten zur ersten Hauptuntersuchung, danach alle 24 Monate. Die Abgasuntersuchung läuft heute im selben Termin mit.

Bei Überziehung: bis zwei Monate passiert meist nichts, ab zwei Monaten wird eine erweiterte Untersuchung fällig, ab vier Monaten drohen Bußgeld und Punkt.

Häufigste Mängel sind Beleuchtung, Bremsen, Reifen und Ölundichtigkeiten – eine kurze Sichtprüfung vorher spart die Nachprüfung.

Trage Dein HU-Datum in den Fahrzeugdaten ein, dann zeigt Dir die Startseite die Frist an.`,
  },
  recall: {
    title: 'Rückruf-Check',
    body: `Ob Dein Fahrzeug von einem Rückruf betroffen ist, prüfst Du über die Fahrgestellnummer.

Offizielle Stellen: das Kraftfahrt-Bundesamt (KBA) führt eine Rückrufdatenbank, zusätzlich hat fast jeder Hersteller eine VIN-Abfrage auf seiner Website.

Rückrufe sind für Dich kostenlos, auch bei älteren Fahrzeugen und unabhängig davon, wo Du das Auto gekauft hast.

Deine Fahrgestellnummer findest Du in den Fahrzeugdaten – dort kannst Du sie mit einem Tipp kopieren.`,
  },
  logbook: {
    title: 'Fahrtenbuch',
    body: `Ein Fahrtenbuch brauchst Du, wenn Du einen Dienstwagen privat nutzt und die 1-%-Regel vermeiden willst, oder wenn das Finanzamt es verlangt.

Pflichtangaben je Fahrt: Datum, Kilometerstand bei Start und Ziel, Reiseziel, Zweck und Geschäftspartner. Privatfahrten reichen mit Kilometerangabe.

Wichtig: Es muss zeitnah und unveränderbar geführt werden – lose Zettel oder eine nachträglich bearbeitete Tabelle erkennt das Finanzamt nicht an.

In dieser Version protokolliert MERAQ Deine Kilometerstände und Werkstattbesuche. Ein finanzamtstaugliches Fahrtenbuch ist bewusst nicht enthalten, weil es hohe formale Anforderungen hat.`,
  },
  help: {
    title: 'Hilfe & Kontakt',
    body: `**Wie aktiviere ich den KI-Assistenten?**
Einstellungen öffnen, einen Anthropic-API-Schlüssel eintragen, auf „Speichern & prüfen" tippen. Der Schlüssel bleibt auf Deinem Gerät.

**Warum sehe ich Beispieldaten?**
Beim ersten Start ist ein Beispielfahrzeug hinterlegt, damit Du alles ausprobieren kannst. Unter „Mein Fahrzeug" legst Du Dein eigenes an und kannst das Beispiel löschen.

**Wo liegen meine Daten?**
Ausschließlich in diesem Browser. Es gibt keinen Server und kein Konto. Löschst Du die Browserdaten oder die App vom Homescreen samt Daten, sind sie weg – exportiere sie vorher in den Einstellungen.

**Wie bekomme ich die App auf den Homescreen?**
iPhone: Teilen-Symbol → „Zum Home-Bildschirm". Android: Menü → „App installieren".`,
  },
}

export default function MoreScreen() {
  const vehicle = useActiveVehicle()
  const activities = useVehicleActivities()
  const [topic, setTopic] = useState<string | null>(null)

  const totalCost = useMemo(
    () => activities.reduce((sum, a) => sum + (a.costEur ?? 0), 0),
    [activities],
  )

  return (
    <Page>
      <HomeHeader />

      <div className="anim-fade-up space-y-6">
        <h1 className="text-[24px] font-bold">Mehr</h1>

        {vehicle && (
          <section>
            <SectionTitle title="Kostenübersicht" />
            <Card>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] text-ink-faint">Erfasste Kosten gesamt</p>
                  <p className="tnum mt-1 text-[26px] leading-none font-bold">{formatEur(totalCost)}</p>
                </div>
                <p className="text-[12px] text-ink-muted">
                  {activities.filter((a) => a.costEur).length} Einträge
                </p>
              </div>
              {vehicle.huDue && (
                <p className="mt-3 border-t border-white/8 pt-3 text-[12.5px] text-ink-muted">
                  Nächste HU: {formatDate(vehicle.huDue)} · {formatRelative(vehicle.huDue)}
                </p>
              )}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle title="Werkstatt-Werkzeuge" />
          <RowGroup>
            <Row
              icon={<Crosshair size={17} />}
              title="Teil im Foto finden"
              subtitle="Motorraum fotografieren, KI markiert die Bauteile"
              to="/part-finder"
            />
            <Row
              icon={<PiggyBank size={17} />}
              title="Was kostet mich das Auto?"
              subtitle="Wertverlust, Steuer, Sprit und Wartung pro Monat"
              to="/costs"
            />
            <Row
              icon={<FileSpreadsheet size={17} />}
              title="Kostenvoranschlag"
              subtitle="Positionen zusammenstellen wie in der Werkstatt"
              to="/quote"
            />
            <Row
              icon={<Search size={17} />}
              title="Fahrzeug nachschlagen"
              subtitle="Gebrauchtwagen prüfen, ohne ihn anzulegen"
              to="/lookup"
            />
            <Row
              icon={<BellRing size={17} />}
              title="Erinnerungen"
              subtitle="HU, Wartung und Ablaufdaten in Deinen Kalender legen"
              to="/reminders"
            />
          </RowGroup>
        </section>

        <section>
          <SectionTitle title="Alle Bereiche" />
          <RowGroup>
            <Row icon={<Stethoscope size={17} />} title="Diagnose" to="/diagnosis" />
            <Row icon={<Wrench size={17} />} title="Wartungsplan" to="/maintenance" />
            <Row icon={<Box size={17} />} title="Handbuch" to="/manual" />
            <Row icon={<BookOpen size={17} />} title="Anleitungen" to="/guides" />
            <Row icon={<TrendingUp size={17} />} title="Marktwert" to="/value" />
            <Row icon={<ShoppingCart size={17} />} title="Teile & Preise" to="/parts" />
            <Row icon={<Calculator size={17} />} title="Reparaturkosten" to="/repair-costs" />
            <Row icon={<MapPin size={17} />} title="Werkstatt finden" to="/workshops" />
          </RowGroup>
        </section>

        <section>
          <SectionTitle title="Rund ums Fahrzeug" />
          <RowGroup>
            <Row icon={<Shield size={17} />} title="Versicherungen" onClick={() => setTopic('insurance')} />
            <Row icon={<BadgeEuro size={17} />} title="Steuern & Abgaben" onClick={() => setTopic('tax')} />
            <Row icon={<ShieldCheck size={17} />} title="HU / AU-Termine" onClick={() => setTopic('hu')} />
            <Row icon={<RotateCcw size={17} />} title="Rückruf-Check" onClick={() => setTopic('recall')} />
            <Row icon={<FileText size={17} />} title="Fahrtenbuch" onClick={() => setTopic('logbook')} />
          </RowGroup>
        </section>

        <section>
          <SectionTitle title="Vollständige Aktivitäten" action={`${activities.length}`} />
          {activities.length === 0 ? (
            <Card>
              <p className="py-3 text-center text-[13px] text-ink-faint">
                Noch keine Aktivitäten erfasst.
              </p>
            </Card>
          ) : (
            <RowGroup>
              {activities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.icon] ?? FileText
                return (
                  <Row
                    key={a.id}
                    icon={<Icon size={17} />}
                    title={a.title}
                    subtitle={`${a.detail ? `${a.detail} · ` : ''}${formatDate(a.date)}`}
                    right={
                      a.costEur != null ? (
                        <span className="tnum shrink-0 text-[13.5px] font-medium">
                          {formatEur(a.costEur)}
                        </span>
                      ) : undefined
                    }
                  />
                )
              })}
            </RowGroup>
          )}
        </section>

        <section>
          <SectionTitle title="App" />
          <RowGroup>
            <Row icon={<Settings size={17} />} title="Einstellungen" to="/settings" />
            <Row icon={<HelpCircle size={17} />} title="Hilfe & Kontakt" onClick={() => setTopic('help')} />
          </RowGroup>
        </section>

        <EstimateNote>
          Die Infotexte sind allgemeine Erklärungen zur Rechtslage in Deutschland (Stand 2026) und keine
          Rechts- oder Steuerberatung. Verbindlich sind immer die Angaben der zuständigen Stelle.
        </EstimateNote>
      </div>

      <Sheet open={!!topic} onClose={() => setTopic(null)} title={topic ? INFO_TOPICS[topic].title : ''}>
        {topic && (
          <div className="space-y-3 text-[14px] leading-relaxed text-ink-muted">
            {INFO_TOPICS[topic].body.split('\n\n').map((p, i) => (
              <p key={i}>
                {p.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
                  part.startsWith('**') ? (
                    <strong key={j} className="font-semibold text-ink">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    part
                  ),
                )}
              </p>
            ))}
            <div className="flex items-start gap-2 rounded-xl bg-white/4 px-3 py-2.5 text-[12px] text-ink-faint">
              <CircleHelp size={14} className="mt-0.5 shrink-0" />
              Frag den KI-Assistenten, wenn Du dazu etwas Konkretes zu Deinem Fahrzeug wissen willst.
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
