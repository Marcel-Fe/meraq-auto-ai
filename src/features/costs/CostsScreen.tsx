import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BadgeEuro,
  CircleHelp,
  Fuel,
  Info,
  Receipt,
  Shield,
  TrendingDown,
  Wrench,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Badge, Button, Card, EstimateNote, Field, Input, SectionTitle, Sheet, cn } from '../../components/ui'
import { useActiveVehicle, useAppStore, useVehicleActivities } from '../../store/useAppStore'
import { calculateCosts, calculateTax } from '../../lib/costs'
import { formatEur, formatEurCents, formatNumber } from '../../lib/format'

export default function CostsScreen() {
  const vehicle = useActiveVehicle()
  const activities = useVehicleActivities()
  const updateVehicle = useAppStore((s) => s.updateVehicle)
  const [editOpen, setEditOpen] = useState(false)
  const [taxOpen, setTaxOpen] = useState(false)

  const costs = useMemo(
    () => (vehicle ? calculateCosts(vehicle, activities) : null),
    [vehicle, activities],
  )
  const tax = useMemo(() => (vehicle ? calculateTax(vehicle) : null), [vehicle])

  if (!vehicle || !costs || !tax) return null

  const rows = [
    {
      icon: <TrendingDown size={17} />,
      label: 'Wertverlust',
      value: costs.depreciation,
      hint: 'aus der Wertschätzung, bezogen auf ein Jahr',
      tone: 'violet' as const,
    },
    {
      icon: <Fuel size={17} />,
      label: vehicle.fuel === 'Elektro' ? 'Strom' : 'Kraftstoff',
      value: costs.fuel,
      hint: `${formatNumber(costs.annualKm)} km · ${formatEurCents(costs.fuelPricePerUnit)}/${costs.fuelUnit}`,
      tone: 'teal' as const,
    },
    {
      icon: <Wrench size={17} />,
      label: 'Wartung & Reparatur',
      value: costs.maintenance,
      hint: costs.maintenanceFromRecords
        ? 'aus Deinen erfassten Belegen der letzten 12 Monate'
        : 'geschätzt – erfasse Rechnungen für echte Zahlen',
      tone: 'blue' as const,
    },
    {
      icon: <Shield size={17} />,
      label: 'Versicherung',
      value: costs.insurance,
      hint: vehicle.insuranceYearlyEur ? 'Dein eingetragener Beitrag' : 'geschätzt nach Fahrzeugwert',
      tone: 'green' as const,
    },
    {
      icon: <BadgeEuro size={17} />,
      label: 'Kfz-Steuer',
      value: costs.tax,
      hint: tax.missing ? 'Angaben fehlen – tippe für Details' : tax.exempt ? 'befreit' : 'nach Gesetz berechnet',
      tone: 'amber' as const,
      onClick: () => setTaxOpen(true),
    },
  ]

  const max = Math.max(...rows.map((r) => r.value), 1)

  const barColor = {
    violet: 'bg-brand-violet',
    teal: 'bg-brand-teal',
    blue: 'bg-brand-blue',
    green: 'bg-ok',
    amber: 'bg-warn',
  }

  return (
    <Page>
      <PageHeader
        title="Was kostet mich das Auto?"
        subtitle={`${vehicle.make} ${vehicle.model}`}
        backTo="/more"
        right={
          <button
            type="button"
            aria-label="Angaben bearbeiten"
            onClick={() => setEditOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Receipt size={18} />
          </button>
        }
      />

      <div className="anim-fade-up space-y-6">
        <Card>
          <p className="text-[12px] text-ink-faint">Gesamtkosten pro Monat</p>
          <p className="tnum mt-1 text-[36px] leading-none font-bold">{formatEur(costs.totalMonth)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="brand">{formatEur(costs.totalYear)} pro Jahr</Badge>
            <Badge>{formatEurCents(costs.perKm)} pro km</Badge>
            <Badge>{formatNumber(costs.annualKm)} km im Jahr</Badge>
          </div>
        </Card>

        <section>
          <SectionTitle title="Woraus sich das zusammensetzt" />
          <Card className="space-y-4">
            {rows.map((r) => {
              const share = costs.totalYear ? (r.value / costs.totalYear) * 100 : 0
              const content = (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/6 text-ink-muted">
                      {r.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-medium">{r.label}</span>
                        <span className="tnum shrink-0 text-[14px] font-semibold">
                          {formatEur(r.value)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11.5px] text-ink-faint">{r.hint}</span>
                        <span className="tnum shrink-0 text-[11.5px] text-ink-faint">
                          {share.toFixed(0)} %
                        </span>
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn('h-full rounded-full', barColor[r.tone])}
                      style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                    />
                  </div>
                </>
              )
              return r.onClick ? (
                <button key={r.label} type="button" onClick={r.onClick} className="w-full text-left">
                  {content}
                </button>
              ) : (
                <div key={r.label}>{content}</div>
              )
            })}
          </Card>
        </section>

        {(!vehicle.displacementCcm || !vehicle.consumption || !vehicle.annualKm) && (
          <Card className="border-brand-blue/30">
            <div className="flex items-start gap-3">
              <Info size={18} className="mt-0.5 shrink-0 text-brand-blue" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">Genauer geht's mit drei Angaben</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  Hubraum und CO₂-Wert stehen im Fahrzeugschein (Felder P.1 und V.7), den
                  Verbrauch kennst Du vom Tanken. Damit wird aus der Schätzung eine Rechnung.
                </p>
                <Button className="mt-3" size="sm" onClick={() => setEditOpen(true)}>
                  Angaben ergänzen
                </Button>
              </div>
            </div>
          </Card>
        )}

        <section>
          <SectionTitle title="Vergleich" />
          <Card className="space-y-3">
            <Comparison
              label="Pro gefahrenem Kilometer"
              value={formatEurCents(costs.perKm)}
              hint="Alles eingerechnet, auch der Wertverlust"
            />
            <Comparison
              label="Ohne Wertverlust"
              value={formatEur(Math.round((costs.totalYear - costs.depreciation) / 12))}
              hint="pro Monat – das ist das Geld, das wirklich abfließt"
            />
            <Comparison
              label="Kilometergeld-Vergleich"
              value={formatEurCents(0.3)}
              hint="Pauschale für Dienstfahrten mit dem Privatwagen (0,30 €/km)"
            />
          </Card>
        </section>

        <EstimateNote>
          Die Kfz-Steuer ist nach Gesetz gerechnet und damit genau, sobald Hubraum und CO₂-Wert
          stimmen. Wertverlust, Versicherung und Wartung sind Schätzungen – trage Deinen echten
          Versicherungsbeitrag ein und erfasse Rechnungen unter „Dokumente", dann rechnet die App
          mit Deinen Zahlen statt mit Durchschnittswerten. Kraftstoffpreise sind Mittelwerte für
          Deutschland (Stand 2026), kein Live-Preis.
        </EstimateNote>
      </div>

      {/* Steuer-Detail */}
      <Sheet open={taxOpen} onClose={() => setTaxOpen(false)} title="Kfz-Steuer">
        <div className="space-y-4">
          {tax.missing ? (
            <Card className="border-warn/30">
              <p className="text-[13.5px] leading-relaxed text-ink-muted">{tax.missing}</p>
              <Button className="mt-3" size="sm" full onClick={() => { setTaxOpen(false); setEditOpen(true) }}>
                Jetzt eintragen
              </Button>
            </Card>
          ) : (
            <>
              <Card>
                <p className="text-[12px] text-ink-faint">Pro Jahr</p>
                <p className="tnum mt-1 text-[28px] font-bold">{formatEur(tax.yearlyEur)}</p>
                <p className="tnum mt-1 text-[12.5px] text-ink-muted">
                  {formatEur(Math.round(tax.yearlyEur / 12))} im Monat
                </p>
              </Card>
              {!tax.exempt && (
                <Card className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] text-ink-muted">Hubraumanteil</span>
                    <span className="tnum text-[14px] font-medium">{formatEurCents(tax.displacementPart)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] text-ink-muted">CO₂-Anteil</span>
                    <span className="tnum text-[14px] font-medium">{formatEurCents(tax.co2Part)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
                    <span className="text-[14px] font-semibold">Summe</span>
                    <span className="tnum text-[16px] font-bold">{formatEurCents(tax.yearlyEur)}</span>
                  </div>
                </Card>
              )}
            </>
          )}
          <Card>
            <div className="flex items-start gap-2.5">
              <CircleHelp size={16} className="mt-0.5 shrink-0 text-brand-blue" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{tax.explanation}</p>
            </div>
          </Card>
          <p className="text-center text-[11.5px] text-ink-faint">
            Gerechnet nach § 9 Kraftfahrzeugsteuergesetz. Verbindlich ist der Bescheid des Zolls.
          </p>
        </div>
      </Sheet>

      {/* Angaben bearbeiten */}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Angaben für die Kostenrechnung">
        <div className="space-y-4">
          <Field label="Hubraum (cm³)" hint="Fahrzeugschein Feld P.1">
            <Input
              type="number"
              inputMode="numeric"
              value={vehicle.displacementCcm ?? ''}
              onChange={(e) =>
                updateVehicle(vehicle.id, {
                  displacementCcm: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="z. B. 1995"
            />
          </Field>
          <Field label="CO₂-Ausstoß (g/km)" hint="Fahrzeugschein Feld V.7">
            <Input
              type="number"
              inputMode="numeric"
              value={vehicle.co2GramPerKm ?? ''}
              onChange={(e) =>
                updateVehicle(vehicle.id, {
                  co2GramPerKm: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="z. B. 124"
            />
          </Field>
          <Field
            label={vehicle.fuel === 'Elektro' ? 'Verbrauch (kWh/100 km)' : 'Verbrauch (l/100 km)'}
            hint="Dein echter Verbrauch, nicht der Prospektwert"
          >
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={vehicle.consumption ?? ''}
              onChange={(e) =>
                updateVehicle(vehicle.id, {
                  consumption: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={vehicle.fuel === 'Elektro' ? 'z. B. 18' : 'z. B. 6,4'}
            />
          </Field>
          <Field label="Fahrleistung pro Jahr (km)">
            <Input
              type="number"
              inputMode="numeric"
              value={vehicle.annualKm ?? ''}
              onChange={(e) =>
                updateVehicle(vehicle.id, {
                  annualKm: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="15000"
            />
          </Field>
          <Field label="Versicherung pro Jahr (€)" hint="Wenn leer, wird geschätzt">
            <Input
              type="number"
              inputMode="numeric"
              value={vehicle.insuranceYearlyEur ?? ''}
              onChange={(e) =>
                updateVehicle(vehicle.id, {
                  insuranceYearlyEur: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder="z. B. 620"
            />
          </Field>
          <Link to="/documents">
            <Button variant="outline" full>
              Fahrzeugschein fotografieren und auslesen
            </Button>
          </Link>
        </div>
      </Sheet>
    </Page>
  )
}

function Comparison({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">{label}</span>
        <span className="block text-[11.5px] text-ink-faint">{hint}</span>
      </span>
      <span className="tnum shrink-0 text-[15px] font-bold">{value}</span>
    </div>
  )
}
