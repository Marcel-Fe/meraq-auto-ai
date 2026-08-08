import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronRight,
  Info,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EstimateNote,
  Input,
  Row,
  RowGroup,
  SectionTitle,
  Sheet,
  cn,
} from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { useActiveVehicle, useAppStore, useVehicleDiagnoses } from '../../store/useAppStore'
import { findHotspotId } from '../../data/manual'
import { DTC_DB, SEVERITY_LABEL, isValidDtc, lookupDtc, normalizeDtc, searchDtc } from '../../lib/dtc'
import type { DtcInfo } from '../../lib/dtc'
import { formatDate, formatRange, todayIso } from '../../lib/format'
import { MONITORED_SYSTEMS } from '../../data/demoVehicle'
import { askAi, describeAiError, hasApiKey } from '../../lib/ai/client'
import { SYSTEM_DTC, vehicleContext } from '../../lib/ai/prompts'
import type { DtcSeverity } from '../../types'

const TONE: Record<DtcSeverity, 'ok' | 'warn' | 'danger'> = {
  info: 'ok',
  warn: 'warn',
  critical: 'danger',
}

export default function DiagnosisScreen() {
  const vehicle = useActiveVehicle()
  const diagnoses = useVehicleDiagnoses()
  const { addDiagnosis, updateDiagnosis, removeDiagnosis } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<DtcInfo | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState('')

  const openCodes = diagnoses.filter((d) => !d.resolved && d.code !== '—')
  const results = useMemo(() => searchDtc(query, vehicle).slice(0, 12), [query, vehicle])
  const typed = normalizeDtc(query)
  const canAddTyped = isValidDtc(typed) && !results.some((r) => r.code === typed)

  const systemStatus = useMemo(() => {
    const affected = new Set(openCodes.map((d) => d.system))
    return MONITORED_SYSTEMS.map((s) => ({
      name: s,
      ok: ![...affected].some((a) => a.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(a.toLowerCase())),
    }))
  }, [openCodes])

  const addCode = (info: DtcInfo) => {
    if (!vehicle) return
    addDiagnosis({
      vehicleId: vehicle.id,
      date: todayIso(),
      code: info.code,
      title: info.title,
      severity: info.severity,
      system: info.system,
      resolved: false,
    })
    setAddOpen(false)
    setQuery('')
  }

  const explain = async (info: DtcInfo, entryId: string) => {
    setDetail(info)
    setDetailId(entryId)
    setExplanation('')
    if (!hasApiKey()) {
      setExplanation('_Für die ausführliche KI-Erklärung brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen)._')
      return
    }
    setExplaining(true)
    let acc = ''
    try {
      await askAi({
        system: SYSTEM_DTC,
        context: vehicleContext(vehicle, diagnoses),
        messages: [
          {
            role: 'user',
            content: `Erkläre mir den Fehlercode ${info.code} (${info.title}, System: ${info.system}).`,
          },
        ],
        onText: (d) => {
          acc += d
          setExplanation(acc)
        },
      })
      updateDiagnosis(entryId, { explanation: acc })
    } catch (err) {
      setExplanation(describeAiError(err))
    } finally {
      setExplaining(false)
    }
  }

  const allClear = openCodes.length === 0

  return (
    <Page>
      <PageHeader
        title="Diagnose"
        backTo="/"
        right={
          <button
            type="button"
            aria-label="Fehlercode hinzufügen"
            onClick={() => setAddOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div className="anim-fade-up space-y-6">
        <Card className="text-center">
          <div
            className={cn(
              'relative mx-auto grid h-32 w-32 place-items-center rounded-full border-[6px]',
              allClear ? 'border-ok/60' : 'border-warn/60',
            )}
          >
            <span
              className={cn(
                'absolute inset-0 rounded-full blur-xl',
                allClear ? 'bg-ok/18' : 'bg-warn/18',
              )}
            />
            <div className="relative">
              <p className="tnum text-[38px] leading-none font-bold">{openCodes.length}</p>
              <p className="mt-1 text-[11px] text-ink-muted">
                {openCodes.length === 1 ? 'Fehlercode' : 'Fehlercodes'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            {allClear ? (
              <CheckCircle2 size={19} className="text-ok" />
            ) : (
              <TriangleAlert size={19} className="text-warn" />
            )}
            <p className="text-[15px] font-semibold">
              {allClear ? 'Alles in Ordnung' : 'Offene Fehlercodes'}
            </p>
          </div>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {allClear
              ? 'Keine offenen Fehlercodes erfasst'
              : 'Tippe einen Code an für Ursachen und Kosten'}
          </p>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <Info size={18} className="mt-0.5 shrink-0 text-brand-blue" />
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Ein Browser kann den OBD-Stecker nicht selbst auslesen – dafür bräuchte es eine native App
              mit Bluetooth-Zugriff. Lies den Code mit einem OBD-Adapter oder in der Werkstatt aus und
              trage ihn hier ein. Die App erklärt ihn dann und schätzt die Kosten.
            </p>
          </div>
          <Button className="mt-3" full variant="outline" icon={<Plus size={17} />} onClick={() => setAddOpen(true)}>
            Fehlercode eintragen
          </Button>
        </Card>

        <section>
          <SectionTitle title="Systeme" />
          <RowGroup>
            {systemStatus.map((s) => (
              <Row
                key={s.name}
                title={s.name}
                right={<Badge tone={s.ok ? 'ok' : 'warn'}>{s.ok ? 'OK' : 'Fehler'}</Badge>}
              />
            ))}
          </RowGroup>
          <EstimateNote>
            Die Ampel basiert auf den von Dir eingetragenen Fehlercodes – nicht auf einer Live-Messung
            am Fahrzeug.
          </EstimateNote>
        </section>

        <section>
          <SectionTitle title="Verlauf" action={`${diagnoses.length}`} />
          {diagnoses.length === 0 ? (
            <Card>
              <p className="py-3 text-center text-[13px] text-ink-faint">
                Noch keine Diagnose erfasst.
              </p>
            </Card>
          ) : (
            <RowGroup>
              {diagnoses.map((d) => {
                const info = lookupDtc(d.code)
                return (
                  <Row
                    key={d.id}
                    icon={
                      d.severity === 'critical' ? (
                        <AlertCircle size={17} className="text-danger" />
                      ) : d.severity === 'warn' ? (
                        <TriangleAlert size={17} className="text-warn" />
                      ) : (
                        <CheckCircle2 size={17} className="text-ok" />
                      )
                    }
                    title={d.code === '—' ? d.title : `${d.code} · ${d.title}`}
                    subtitle={`${d.system} · ${formatDate(d.date)}`}
                    onClick={info ? () => explain(info, d.id) : undefined}
                    right={
                      d.resolved ? <Badge tone="ok">erledigt</Badge> : <Badge tone={TONE[d.severity]}>{SEVERITY_LABEL[d.severity]}</Badge>
                    }
                  />
                )
              })}
            </RowGroup>
          )}
        </section>
      </div>

      {/* Code hinzufügen */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Fehlercode eintragen">
        <div className="relative mb-4">
          <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Code oder Stichwort, z. B. P0300"
            className="pl-10 uppercase"
            autoFocus
          />
        </div>

        {canAddTyped && (
          <button
            type="button"
            onClick={() => {
              const info = lookupDtc(typed)
              if (info) addCode(info)
            }}
            className="glass mb-3 flex w-full items-center gap-3 rounded-xl p-3 text-left"
          >
            <Plus size={18} className="text-brand-blue" />
            <span>
              <span className="block text-[14px] font-medium">{typed} eintragen</span>
              <span className="block text-[12px] text-ink-muted">
                Nicht in der Liste – die KI kann ihn trotzdem erklären
              </span>
            </span>
          </button>
        )}

        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => addCode(r)}
              className="glass flex w-full items-start gap-3 rounded-xl p-3 text-left"
            >
              <Badge tone={TONE[r.severity]} className="mt-0.5 shrink-0">
                {r.code}
              </Badge>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{r.title}</span>
                <span className="block text-[12px] text-ink-muted">
                  {r.system} · {r.costMin > 0 ? formatRange(r.costMin, r.costMax) : 'Kosten je nach Ursache'}
                </span>
              </span>
            </button>
          ))}
          {results.length === 0 && !canAddTyped && (
            <p className="py-4 text-center text-[13px] text-ink-faint">
              Kein Treffer. Gib den Code genau ein, z. B. P0420.
            </p>
          )}
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
          Vorgeschlagen werden die genormten OBD-II-Codes, die es bei Deinem Fahrzeug geben kann.
          Jeden anderen Code kannst Du oben eintippen – auch herstellerspezifische, die die KI
          mit Deinem Fahrzeugkontext einordnet.
        </p>
      </Sheet>

      {/* Detail + KI-Erklärung */}
      <Sheet
        open={!!detail}
        onClose={() => {
          setDetail(null)
          setDetailId(null)
        }}
        title={detail ? `${detail.code}` : ''}
      >
        {detail && (
          <div className="space-y-4">
            <div>
              <h4 className="text-[16px] font-semibold">{detail.title}</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={TONE[detail.severity]}>{SEVERITY_LABEL[detail.severity]}</Badge>
                <Badge>{detail.system}</Badge>
                <Badge tone={detail.driveable === 'nein' ? 'danger' : detail.driveable === 'ja' ? 'ok' : 'warn'}>
                  Weiterfahren: {detail.driveable}
                </Badge>
              </div>
            </div>

            {detail.causes.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-semibold">Häufigste Ursachen</p>
                <ul className="space-y-1.5">
                  {detail.causes.map((c) => (
                    <li key={c} className="flex gap-2 text-[13.5px] text-ink-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Von der Ursache zur Stelle am Fahrzeug – ohne den Umweg über „Mehr" */}
            {(() => {
              const spotId = vehicle
                ? findHotspotId(`${detail.title} ${detail.system} ${detail.causes.join(' ')}`, vehicle)
                : undefined
              if (!spotId) return null
              return (
                <Link
                  to={`/manual?teil=${spotId}`}
                  className="glass flex items-center gap-3 rounded-[15px] px-4 py-3 transition active:scale-[.99]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-teal/15 text-brand-teal">
                    <Box size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">Wo sitzt das am Fahrzeug?</span>
                    <span className="block text-[12px] text-ink-muted">Im Modell zeigen</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-faint" />
                </Link>
              )
            })()}

            {detail.costMin > 0 && (
              <Card>
                <p className="text-[12px] text-ink-faint">Geschätzte Reparaturkosten</p>
                <p className="tnum mt-1 text-[22px] font-bold">
                  {formatRange(detail.costMin, detail.costMax)}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-faint">
                  Erfahrungswert inkl. Arbeitszeit – die tatsächliche Ursache entscheidet.
                </p>
              </Card>
            )}

            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-violet" />
                <p className="text-[13px] font-semibold">KI-Erklärung</p>
              </div>
              <Card>
                {explanation ? (
                  <div className="text-[14px] text-ink-muted">
                    <Markdown text={explanation} />
                    {explaining && <span className="inline-block animate-pulse">▍</span>}
                  </div>
                ) : (
                  <p className="py-2 text-center text-[13px] text-ink-faint">
                    {explaining ? 'Die KI denkt nach…' : 'Wird geladen…'}
                  </p>
                )}
              </Card>
              {!hasApiKey() && (
                <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                  Kostenlos einrichten
                </Link>
              )}
            </div>

            {detailId && (
              <div className="flex gap-2 border-t border-white/8 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  full
                  icon={<CheckCircle2 size={15} />}
                  onClick={() => {
                    updateDiagnosis(detailId, { resolved: true })
                    setDetail(null)
                  }}
                >
                  Als erledigt markieren
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={15} />}
                  onClick={() => {
                    removeDiagnosis(detailId)
                    setDetail(null)
                  }}
                >
                  Löschen
                </Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </Page>
  )
}

export { DTC_DB }
