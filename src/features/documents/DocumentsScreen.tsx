import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Check,
  FileText,
  FolderOpen,
  Plus,
  Receipt,
  ScanLine,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Row,
  RowGroup,
  SectionTitle,
  Select,
  Sheet,
  cn,
} from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import {
  useActiveVehicle,
  useAppStore,
  useVehicleDocuments,
  useVehicleMaintenance,
} from '../../store/useAppStore'
import { deleteFile, fileToDataUrl, getFile, putFile } from '../../lib/fileStore'
import { formatDate, formatKm, formatRelative, todayIso, uid } from '../../lib/format'
import {
  askAi,
  askAiStructured,
  describeAiError,
  hasApiKey,
  userMessage,
} from '../../lib/ai/client'
import { SYSTEM_DOCUMENT, SYSTEM_INVOICE, vehicleContext } from '../../lib/ai/prompts'
import type { DocumentCategory, MaintenanceKind, VehicleDocument } from '../../types'

const CATEGORIES: DocumentCategory[] = [
  'Fahrzeugschein',
  'Fahrzeugbrief',
  'HU-Bericht',
  'Rechnung',
  'Serviceheft',
  'Versicherung',
  'Garantie',
  'Kaufvertrag',
  'Sonstiges',
]

/** Bei diesen Kategorien lohnt sich das strukturierte Auslesen als Kostenbeleg */
const INVOICE_CATEGORIES: DocumentCategory[] = ['Rechnung', 'Serviceheft']

const MAINTENANCE_KINDS: MaintenanceKind[] = [
  'oil',
  'inspection',
  'brake-fluid',
  'air-filter',
  'cabin-filter',
  'spark-plugs',
  'timing-belt',
  'ac-service',
  'tires',
  'battery',
  'hu',
  'chain',
  'valve-clearance',
  'coolant',
  'dpf',
  'hv-battery',
]

interface InvoiceResult {
  summary: string
  services: string[]
  totalGrossEur?: number
  date?: string
  workshop?: string
  mileage?: number
  maintenanceKinds?: MaintenanceKind[]
  note?: string
}

const INVOICE_SCHEMA = {
  type: 'object' as const,
  properties: {
    summary: {
      type: 'string',
      description:
        'Kurze Bezeichnung für den Verlauf, höchstens 60 Zeichen. Zum Beispiel "Ölwechsel und Inspektion".',
    },
    services: {
      type: 'array',
      items: { type: 'string' },
      description: 'Die einzelnen Positionen des Belegs – Arbeiten und verbaute Teile, je sehr kurz.',
    },
    totalGrossEur: {
      type: 'number',
      description:
        'Endsumme brutto in Euro, inklusive Mehrwertsteuer. Nur eintragen, wenn eindeutig lesbar.',
    },
    date: { type: 'string', description: 'Rechnungsdatum im Format JJJJ-MM-TT' },
    workshop: { type: 'string', description: 'Name der Werkstatt oder des Händlers' },
    mileage: { type: 'number', description: 'Kilometerstand laut Beleg, nur die Zahl' },
    maintenanceKinds: {
      type: 'array',
      items: { type: 'string', enum: MAINTENANCE_KINDS },
      description:
        'Wartungsarten, die auf dem Beleg eindeutig erledigt wurden. oil = Ölwechsel, ' +
        'inspection = Inspektion/Service, brake-fluid = Bremsflüssigkeit, air-filter = Luftfilter, ' +
        'cabin-filter = Innenraum-/Pollenfilter, spark-plugs = Zünd- oder Glühkerzen, ' +
        'timing-belt = Zahnriemen/Steuerkette, ac-service = Klimaservice, tires = Reifen, ' +
        'battery = Starterbatterie, hu = Hauptuntersuchung/TÜV, chain = Antriebskette, ' +
        'valve-clearance = Ventilspiel, coolant = Kühlmittel, dpf = Partikelfilter, ' +
        'hv-battery = Hochvoltbatterie. Im Zweifel weglassen.',
    },
    note: {
      type: 'string',
      description:
        'Hinweis, wenn etwas unklar ist – zum Beispiel unlesbarer Betrag oder abgeschnittener Beleg.',
    },
  },
  required: ['summary', 'services'],
}

interface InvoiceDraft {
  title: string
  amount: string
  date: string
  mileage: string
  workshop: string
  services: string
}

export default function DocumentsScreen() {
  const vehicle = useActiveVehicle()
  const documents = useVehicleDocuments()
  const maintenance = useVehicleMaintenance()
  const { addDocument, updateDocument, removeDocument, addActivity, updateMaintenance } =
    useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | undefined>()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('Rechnung')
  const [expiresAt, setExpiresAt] = useState('')

  const [detail, setDetail] = useState<VehicleDocument | null>(null)
  const [detailImage, setDetailImage] = useState<string | undefined>()
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState('')

  // Beleg-Auswertung: Ergebnis der KI landet zuerst in einem Formular,
  // gespeichert wird erst, wenn der Nutzer jeden Wert gesehen hat.
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceNote, setInvoiceNote] = useState('')
  const [draft, setDraft] = useState<InvoiceDraft | null>(null)
  /** Vorschläge der KI – bleiben sichtbar, auch wenn der Nutzer sie abwählt */
  const [suggestedIds, setSuggestedIds] = useState<string[]>([])
  const [matchedIds, setMatchedIds] = useState<string[]>([])

  useEffect(() => {
    if (!detail?.fileKey) {
      setDetailImage(undefined)
      return
    }
    getFile(detail.fileKey).then(setDetailImage)
  }, [detail])

  const expiring = useMemo(
    () =>
      documents.filter(
        (d) => d.expiresAt && new Date(d.expiresAt).getTime() - Date.now() < 60 * 86_400_000,
      ),
    [documents],
  )

  const pickFile = async (file?: File) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file, 1800)
    setPendingImage(dataUrl)
    setTitle(file.name.replace(/\.[^.]+$/, ''))
    setAddOpen(true)
  }

  const save = async () => {
    if (!vehicle || !title.trim()) return
    let fileKey: string | undefined
    if (pendingImage) {
      fileKey = `doc-${uid()}`
      await putFile(fileKey, pendingImage)
    }
    addDocument({
      vehicleId: vehicle.id,
      title: title.trim(),
      category,
      date: todayIso(),
      expiresAt: expiresAt || undefined,
      fileKey,
      mimeType: pendingImage?.slice(5, pendingImage.indexOf(';')),
    })
    setAddOpen(false)
    setPendingImage(undefined)
    setTitle('')
    setExpiresAt('')
  }

  const extract = async () => {
    if (!detail || !detailImage) return
    if (!hasApiKey()) {
      setExtracted('_Zum Auslesen brauchst Du einen KI-Schlüssel – bei Google gibt es ihn kostenlos (Einstellungen)._')
      return
    }
    setExtracting(true)
    setExtracted('')
    let acc = ''
    try {
      await askAi({
        system: SYSTEM_DOCUMENT,
        context: vehicleContext(vehicle),
        messages: [
          userMessage(
            `Lies dieses Dokument aus. Es ist laut Nutzer ein Dokument der Kategorie "${detail.category}".`,
            detailImage,
          ),
        ],
        onText: (d) => {
          acc += d
          setExtracted(acc)
        },
      })
      updateDocument(detail.id, { extracted: acc })
    } catch (err) {
      setExtracted(describeAiError(err))
    } finally {
      setExtracting(false)
    }
  }

  const analyseInvoice = async () => {
    if (!detail || !detailImage || !vehicle) return
    if (!hasApiKey()) {
      setInvoiceError('Zum Auswerten brauchst Du einen KI-Schlüssel. Bei Google bekommst Du ihn kostenlos – eintragen in den Einstellungen.')
      return
    }
    setInvoiceLoading(true)
    setInvoiceError('')
    setInvoiceNote('')
    try {
      const res = await askAiStructured<InvoiceResult>({
        system: SYSTEM_INVOICE,
        context: vehicleContext(vehicle),
        messages: [
          userMessage(
            `Lies diesen Beleg aus. Der Nutzer hat ihn als "${detail.category}" abgelegt.`,
            detailImage,
          ),
        ],
        toolName: 'beleg_uebernehmen',
        toolDescription:
          'Trägt die Angaben des Belegs in das Formular ein, das der Nutzer anschließend prüft und bestätigt.',
        schema: INVOICE_SCHEMA,
      })

      if (res.services.length === 0 && res.totalGrossEur == null) {
        setInvoiceError(
          res.note ||
            'Auf dem Bild war kein Beleg zu erkennen. Versuche es mit einem schärferen Foto der ganzen Rechnung.',
        )
        return
      }

      setDraft({
        title: res.summary?.slice(0, 60) || detail.title,
        amount: res.totalGrossEur != null ? String(res.totalGrossEur) : '',
        date: isoDay(res.date) || isoDay(detail.date) || isoDay(todayIso()),
        mileage: res.mileage != null ? String(res.mileage) : '',
        workshop: res.workshop ?? '',
        services: res.services.join(', '),
      })
      // Nur Positionen vorschlagen, die es bei diesem Fahrzeug wirklich gibt –
      // ein E-Auto bekommt so auch dann keinen Ölwechsel, wenn er auf dem Beleg steht.
      const matches = maintenance
        .filter((m) => res.maintenanceKinds?.includes(m.kind))
        .map((m) => m.id)
      setSuggestedIds(matches)
      setMatchedIds(matches)
      setInvoiceNote(res.note ?? '')

      const summaryText = invoiceMarkdown(res)
      setExtracted(summaryText)
      updateDocument(detail.id, { extracted: summaryText })
    } catch (err) {
      setInvoiceError(describeAiError(err))
    } finally {
      setInvoiceLoading(false)
    }
  }

  const confirmInvoice = () => {
    if (!draft || !vehicle || !draft.title.trim()) return
    const costEur = parseAmount(draft.amount)
    const mileage = parseMileage(draft.mileage)
    const date = fromDayInput(draft.date)
    const detailText = [draft.services.trim(), draft.workshop.trim()].filter(Boolean).join(' · ')

    addActivity({
      vehicleId: vehicle.id,
      date,
      title: draft.title.trim(),
      detail: detailText || undefined,
      icon: 'invoice',
      costEur,
      mileage,
    })

    // Bewusst nicht completeMaintenance(): das würde auf heute und den aktuellen
    // Kilometerstand setzen. Der Beleg weiß es genauer.
    for (const id of matchedIds) {
      // Ohne Kilometerstand auf dem Beleg nur das Datum setzen – sonst würde
      // ein vorhandener Stand mit "undefined" überschrieben.
      updateMaintenance(id, mileage != null ? { lastDoneAt: date, lastDoneKm: mileage } : { lastDoneAt: date })
    }

    setDraft(null)
    setMatchedIds([])
    setSuggestedIds([])
    setDetail(null)
  }

  const remove = async (doc: VehicleDocument) => {
    if (doc.fileKey) await deleteFile(doc.fileKey)
    removeDocument(doc.id)
    setDetail(null)
  }

  return (
    <Page>
      <PageHeader
        title="Dokumente"
        subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
        backTo="/"
        right={
          <button
            type="button"
            aria-label="Dokument hinzufügen"
            onClick={() => fileRef.current?.click()}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Plus size={20} />
          </button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0])}
      />

      <div className="anim-fade-up space-y-5">
        {/* Hier landen die Rechnungen – der Weg zum Verstehen gehört daneben */}
        <Link to="/invoice">
          <Card className="border-brand-teal/30 transition active:scale-[.99]">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-brand-teal/15 text-brand-teal">
                <Receipt size={21} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold">Werkstattrechnung erklären</span>
                <span className="block text-[12.5px] text-ink-muted">
                  Was wurde gemacht, warum – und welches Teil ist gemeint?
                </span>
              </span>
            </div>
          </Card>
        </Link>

        {expiring.length > 0 && (
          <Card className="border-warn/30">
            <div className="flex items-start gap-3">
              <AlertTriangle size={19} className="mt-0.5 shrink-0 text-warn" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-warn">Läuft bald ab</p>
                {expiring.map((d) => (
                  <p key={d.id} className="mt-1 truncate text-[12.5px] text-ink-muted">
                    {d.title} · {formatRelative(d.expiresAt)}
                  </p>
                ))}
              </div>
            </div>
          </Card>
        )}

        {documents.length === 0 ? (
          <EmptyState
            icon={<FolderOpen size={26} />}
            title="Noch keine Dokumente"
            text="Fotografiere Fahrzeugschein, Rechnungen oder den HU-Bericht. Alles bleibt auf diesem Gerät – nichts wird hochgeladen."
            action={
              <Button icon={<ScanLine size={17} />} onClick={() => fileRef.current?.click()}>
                Dokument aufnehmen
              </Button>
            }
          />
        ) : (
          <section>
            <SectionTitle title="Alle Dokumente" action={`${documents.length}`} />
            <RowGroup>
              {documents.map((d) => (
                <Row
                  key={d.id}
                  icon={<FileText size={17} />}
                  title={d.title}
                  subtitle={`${d.category} · ${formatDate(d.date)}`}
                  onClick={() => {
                    setDetail(d)
                    setExtracted(d.extracted ?? '')
                    setInvoiceError('')
                    setInvoiceNote('')
                  }}
                  right={
                    d.expiresAt ? (
                      <Badge
                        tone={
                          new Date(d.expiresAt).getTime() < Date.now()
                            ? 'danger'
                            : new Date(d.expiresAt).getTime() - Date.now() < 60 * 86_400_000
                              ? 'warn'
                              : 'ok'
                        }
                      >
                        {formatDate(d.expiresAt)}
                      </Badge>
                    ) : undefined
                  }
                />
              ))}
            </RowGroup>
          </section>
        )}

        <Button full variant="outline" icon={<ScanLine size={17} />} onClick={() => fileRef.current?.click()}>
          Dokument hinzufügen
        </Button>

        <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
          Dokumente liegen nur in diesem Browser. Bei Bedarf kannst Du sie in den Einstellungen
          exportieren.
        </p>
      </div>

      {/* Hinzufügen */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Dokument hinzufügen">
        <div className="space-y-4">
          {pendingImage?.startsWith('data:image') && (
            <img src={pendingImage} alt="Vorschau" className="max-h-52 w-full rounded-xl object-contain" />
          )}
          <Field label="Bezeichnung">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Rechnung Ölwechsel" />
          </Field>
          <Field label="Kategorie">
            <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Läuft ab am" hint="optional – z. B. HU-Termin oder Versicherungsende">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <Button full size="lg" onClick={save} disabled={!title.trim()}>
            Speichern
          </Button>
        </div>
      </Sheet>

      {/* Detail */}
      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.title}>
        {detail && (
          <div className="space-y-4">
            {detailImage?.startsWith('data:image') ? (
              <img src={detailImage} alt={detail.title} className="w-full rounded-xl object-contain" />
            ) : detailImage ? (
              <Card className="text-center">
                <FileText size={30} className="mx-auto mb-2 text-ink-faint" />
                <p className="text-[13px] text-ink-muted">
                  PDF-Datei – Vorschau im Browser nicht möglich
                </p>
              </Card>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{detail.category}</Badge>
              <Badge>{formatDate(detail.date)}</Badge>
              {detail.expiresAt && <Badge tone="warn">läuft ab {formatDate(detail.expiresAt)}</Badge>}
            </div>

            {extracted ? (
              <Card>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles size={15} className="text-brand-violet" />
                  <span className="text-[12.5px] font-semibold">Ausgelesene Angaben</span>
                </div>
                <div className="text-[13.5px] text-ink-muted">
                  <Markdown text={extracted} />
                  {extracting && <span className="inline-block animate-pulse">▍</span>}
                </div>
                {!hasApiKey() && (
                  <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                    Kostenlos einrichten
                  </Link>
                )}
              </Card>
            ) : (
              detailImage?.startsWith('data:image') && (
                <Button
                  full
                  variant="outline"
                  loading={extracting}
                  icon={<Sparkles size={17} />}
                  onClick={extract}
                >
                  Mit KI auslesen
                </Button>
              )
            )}

            {INVOICE_CATEGORIES.includes(detail.category) && detailImage?.startsWith('data:image') && (
              <>
                <Button
                  full
                  size="lg"
                  loading={invoiceLoading}
                  icon={<Receipt size={18} />}
                  onClick={analyseInvoice}
                >
                  Als Kostenbeleg übernehmen
                </Button>
                <p className="text-center text-[11.5px] leading-relaxed text-ink-faint">
                  Die KI liest Betrag, Datum und Leistung aus. Du prüfst jeden Wert, bevor er im
                  Verlauf und in der Kostenrechnung landet.
                </p>
              </>
            )}

            {invoiceError && (
              <Card className="border-danger/30">
                <p className="text-[13px] text-danger">{invoiceError}</p>
                {!hasApiKey() && (
                  <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                    Kostenlos einrichten
                  </Link>
                )}
              </Card>
            )}

            <Button variant="ghost" full icon={<Trash2 size={16} />} onClick={() => remove(detail)}>
              Dokument löschen
            </Button>
          </div>
        )}
      </Sheet>

      {/* Beleg prüfen und übernehmen */}
      <Sheet open={!!draft} onClose={() => setDraft(null)} title="Beleg übernehmen">
        {draft && (
          <div className="space-y-4">
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              So hat die KI den Beleg gelesen. Prüfe die Werte und ändere, was nicht stimmt –
              gespeichert wird erst mit dem Knopf unten.
            </p>

            {invoiceNote && (
              <Card className="border-warn/30">
                <p className="text-[12.5px] leading-relaxed text-warn">{invoiceNote}</p>
              </Card>
            )}

            <Field label="Bezeichnung">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="z. B. Ölwechsel und Inspektion"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Betrag brutto (€)" hint="leer lassen, wenn nicht lesbar">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  placeholder="0,00"
                />
              </Field>
              <Field label="Datum">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kilometerstand">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={draft.mileage}
                  onChange={(e) => setDraft({ ...draft, mileage: e.target.value })}
                  placeholder="optional"
                />
              </Field>
              <Field label="Werkstatt">
                <Input
                  value={draft.workshop}
                  onChange={(e) => setDraft({ ...draft, workshop: e.target.value })}
                  placeholder="optional"
                />
              </Field>
            </div>

            <Field label="Leistungen">
              <Input
                value={draft.services}
                onChange={(e) => setDraft({ ...draft, services: e.target.value })}
                placeholder="z. B. Motoröl 5W-30, Ölfilter, Arbeitslohn"
              />
            </Field>

            {suggestedIds.length > 0 && (
              <section>
                <p className="mb-2 text-[12.5px] font-semibold">Passende Wartungspositionen</p>
                <div className="space-y-2">
                  {maintenance
                    .filter((m) => suggestedIds.includes(m.id))
                    .map((m) => {
                      const on = matchedIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setMatchedIds((ids) =>
                              ids.includes(m.id) ? ids.filter((i) => i !== m.id) : [...ids, m.id],
                            )
                          }
                          className={cn(
                            'flex min-h-[44px] w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left transition',
                            on ? 'border-brand-blue/50 bg-brand-blue/10' : 'border-white/10 bg-white/4',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                              on ? 'border-brand-blue bg-brand-blue text-white' : 'border-white/25',
                            )}
                          >
                            {on && <Check size={13} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium">{m.label}</span>
                            <span className="tnum block text-[11.5px] text-ink-faint">
                              bisher {m.lastDoneAt ? formatDate(m.lastDoneAt) : 'ohne Datum'}
                              {m.lastDoneKm != null && ` · ${formatKm(m.lastDoneKm)}`}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
                  Angehakte Positionen werden auf Datum und Kilometerstand des Belegs gesetzt.
                </p>
              </section>
            )}

            <Button
              size="lg"
              full
              icon={<Check size={18} />}
              onClick={confirmInvoice}
              disabled={!draft.title.trim()}
            >
              In den Verlauf übernehmen
            </Button>
            <Button variant="ghost" full onClick={() => setDraft(null)}>
              Verwerfen
            </Button>
          </div>
        )}
      </Sheet>
    </Page>
  )
}

/** "2026-06-04" aus einem ISO-Datum oder einer KI-Angabe – für <input type="date"> */
function isoDay(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Wert eines Datumsfeldes zurück in ein volles ISO-Datum */
function fromDayInput(value: string) {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? todayIso() : d.toISOString()
}

function parseAmount(value: string) {
  const n = Number(value.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
}

function parseMileage(value: string) {
  const n = Number(value.replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function invoiceMarkdown(res: InvoiceResult) {
  const lines = [
    res.totalGrossEur != null ? `**Betrag brutto:** ${res.totalGrossEur.toLocaleString('de-DE')} €` : '',
    res.date ? `**Datum:** ${formatDate(res.date)}` : '',
    res.workshop ? `**Werkstatt:** ${res.workshop}` : '',
    res.mileage != null ? `**Kilometerstand:** ${formatKm(res.mileage)}` : '',
    res.services.length ? `\n**Leistungen**` : '',
    ...res.services.map((s) => `- ${s}`),
    res.note ? `\n_${res.note}_` : '',
  ].filter(Boolean)
  return lines.join('\n')
}
