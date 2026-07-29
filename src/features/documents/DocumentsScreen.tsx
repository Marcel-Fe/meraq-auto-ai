import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  FileText,
  FolderOpen,
  Plus,
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
} from '../../components/ui'
import { Markdown } from '../../components/Markdown'
import { useActiveVehicle, useAppStore, useVehicleDocuments } from '../../store/useAppStore'
import { deleteFile, fileToDataUrl, getFile, putFile } from '../../lib/fileStore'
import { formatDate, formatRelative, todayIso, uid } from '../../lib/format'
import { askClaude, describeAiError, hasApiKey, userMessage } from '../../lib/ai/client'
import { SYSTEM_DOCUMENT, vehicleContext } from '../../lib/ai/prompts'
import type { DocumentCategory, VehicleDocument } from '../../types'

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

export default function DocumentsScreen() {
  const vehicle = useActiveVehicle()
  const documents = useVehicleDocuments()
  const { addDocument, updateDocument, removeDocument } = useAppStore()
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
      setExtracted('_Zum Auslesen brauchst Du einen API-Schlüssel (Einstellungen)._')
      return
    }
    setExtracting(true)
    setExtracted('')
    let acc = ''
    try {
      await askClaude({
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
                    API-Schlüssel eintragen
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

            <Button variant="ghost" full icon={<Trash2 size={16} />} onClick={() => remove(detail)}>
              Dokument löschen
            </Button>
          </div>
        )}
      </Sheet>
    </Page>
  )
}
