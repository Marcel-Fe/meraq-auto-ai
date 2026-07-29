import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  BookmarkCheck,
  Camera,
  Crosshair,
  ImagePlus,
  Info,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
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
  cn,
} from '../../components/ui'
import { useActiveVehicle, useAppStore, useVehiclePartScans } from '../../store/useAppStore'
import { deleteFile, fileToDataUrl, getFile, putFile } from '../../lib/fileStore'
import { formatDate, todayIso, uid } from '../../lib/format'
import { askClaudeStructured, describeAiError, hasApiKey, userMessage } from '../../lib/ai/client'
import { SYSTEM_PART_FINDER, vehicleContext } from '../../lib/ai/prompts'
import type { DetectedPart, PartScan } from '../../types'

interface FindResult {
  scene: string
  parts: DetectedPart[]
  note?: string
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    scene: {
      type: 'string',
      description:
        'Was auf dem Bild zu sehen ist, in einem kurzen Satz. Zum Beispiel "Motorraum eines Vierzylinder-Diesels von oben".',
    },
    parts: {
      type: 'array',
      description:
        'Die erkannten Bauteile. Nur eintragen, was wirklich im Bild sichtbar ist – lieber wenige sichere als viele geratene.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Name des Bauteils auf Deutsch' },
          x: {
            type: 'number',
            description: 'Waagerechte Position der Bildmitte des Bauteils, 0 = linker Rand, 100 = rechter Rand',
          },
          y: {
            type: 'number',
            description: 'Senkrechte Position, 0 = oberer Rand, 100 = unterer Rand',
          },
          fn: { type: 'string', description: 'Wofür das Bauteil da ist, ein bis zwei Sätze in Alltagssprache' },
          looksLike: {
            type: 'string',
            description:
              'Woran man es im Bild erkennt: Farbe, Form, Beschriftung, Nachbarteile. Ein Satz.',
          },
          problems: {
            type: 'array',
            items: { type: 'string' },
            description: 'Bis zu drei typische Probleme, jeweils sehr kurz',
          },
          confidence: {
            type: 'string',
            enum: ['sicher', 'wahrscheinlich', 'unsicher'],
            description: 'Wie sicher die Erkennung ist. Bei Zweifeln "unsicher" wählen.',
          },
        },
        required: ['label', 'x', 'y', 'fn', 'looksLike', 'confidence'],
      },
    },
    note: {
      type: 'string',
      description:
        'Optionaler Hinweis, zum Beispiel wenn das Bild unscharf ist, Teile verdeckt sind oder ein anderer Blickwinkel helfen würde.',
    },
  },
  required: ['scene', 'parts'],
}

const CONFIDENCE_TONE = {
  sicher: 'ok',
  wahrscheinlich: 'warn',
  unsicher: 'danger',
} as const

export default function PartFinderScreen() {
  const vehicle = useActiveVehicle()
  const scans = useVehiclePartScans()
  const addPartScan = useAppStore((s) => s.addPartScan)
  const removePartScan = useAppStore((s) => s.removePartScan)

  const fileRef = useRef<HTMLInputElement>(null)
  const [image, setImage] = useState<string>()
  const [result, setResult] = useState<FindResult>()
  const [active, setActive] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  /** Gesetzt, wenn gerade eine gemerkte Aufnahme angesehen wird */
  const [openScan, setOpenScan] = useState<PartScan | null>(null)
  const [saved, setSaved] = useState(false)

  const pick = async (file?: File) => {
    if (!file) return
    setImage(await fileToDataUrl(file, 1400))
    setResult(undefined)
    setActive(null)
    setError('')
    setOpenScan(null)
    setSaved(false)
  }

  const save = async () => {
    if (!vehicle || !result || !image || result.parts.length === 0) return
    const fileKey = `scan-${uid()}`
    await putFile(fileKey, image)
    addPartScan({
      vehicleId: vehicle.id,
      date: todayIso(),
      title: result.scene.slice(0, 70),
      fileKey,
      parts: result.parts,
      note: result.note,
    })
    setSaved(true)
  }

  const openSaved = async (scan: PartScan) => {
    const file = scan.fileKey ? await getFile(scan.fileKey) : undefined
    if (!file) {
      setError('Das Foto zu dieser Aufnahme ist nicht mehr auf dem Gerät. Nimm ein neues auf.')
      return
    }
    setImage(file)
    setResult({ scene: scan.title, parts: scan.parts, note: scan.note })
    setActive(null)
    setError('')
    setOpenScan(scan)
    setSaved(true)
  }

  const removeSaved = async (scan: PartScan) => {
    if (scan.fileKey) await deleteFile(scan.fileKey)
    removePartScan(scan.id)
    reset()
  }

  const analyse = async () => {
    if (!image) return
    if (!hasApiKey()) {
      setError('Dafür brauchst Du einen API-Schlüssel. Du trägst ihn in den Einstellungen ein.')
      return
    }
    setLoading(true)
    setError('')
    setResult(undefined)
    try {
      const prompt = question.trim()
        ? `Auf diesem Foto meines Fahrzeugs suche ich: ${question.trim()}. ` +
          `Markiere dieses Teil, falls es zu sehen ist, und zusätzlich die wichtigsten anderen Bauteile im Bild.`
        : 'Welche Bauteile sind auf diesem Foto meines Fahrzeugs zu sehen? Markiere die wichtigsten.'

      const res = await askClaudeStructured<FindResult>({
        system: SYSTEM_PART_FINDER,
        context: vehicleContext(vehicle),
        messages: [userMessage(prompt, image)],
        toolName: 'bauteile_markieren',
        toolDescription:
          'Trägt die im Foto erkannten Bauteile mit ihrer ungefähren Position ein, damit die App sie im Bild markieren kann.',
        schema: SCHEMA,
        maxTokens: 3000,
      })
      setResult(res)
      if (res.parts.length === 0) {
        setError('Auf dem Bild waren keine Bauteile sicher zu erkennen. Versuche es näher oder heller.')
      }
    } catch (err) {
      setError(describeAiError(err))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setImage(undefined)
    setResult(undefined)
    setActive(null)
    setError('')
    setOpenScan(null)
    setSaved(false)
  }

  return (
    <Page>
      <PageHeader
        title="Teil im Foto finden"
        subtitle={vehicle ? `${vehicle.make} ${vehicle.model}` : undefined}
        backTo="/manual"
        right={
          image ? (
            <button
              type="button"
              aria-label="Neues Foto"
              onClick={reset}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-muted active:bg-white/6"
            >
              <RotateCcw size={18} />
            </button>
          ) : undefined
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <div className="anim-fade-up space-y-4">
        {!image ? (
          <>
            <Card className="text-center">
              <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-brand-teal/15 text-brand-teal">
                <Crosshair size={30} />
              </span>
              <h2 className="text-[17px] font-semibold">Wo sitzt welches Teil?</h2>
              <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">
                Mach ein Foto von Deinem geöffneten Motorraum, dem Fußraum oder dem Radkasten.
                Die KI markiert die Bauteile direkt im Bild und erklärt Dir jedes einzelne.
              </p>
              <div className="mt-5 grid gap-2.5">
                <Button size="lg" icon={<Camera size={19} />} onClick={() => fileRef.current?.click()}>
                  Foto aufnehmen
                </Button>
                <Button variant="outline" icon={<ImagePlus size={17} />} onClick={() => fileRef.current?.click()}>
                  Bild aus der Galerie
                </Button>
              </div>
            </Card>

            {scans.length > 0 && (
              <section>
                <SectionTitle title="Gemerkte Aufnahmen" action={`${scans.length}`} />
                <RowGroup>
                  {scans.map((s) => (
                    <Row
                      key={s.id}
                      icon={<Bookmark size={17} />}
                      title={s.title}
                      subtitle={`${s.parts.length} ${s.parts.length === 1 ? 'Bauteil' : 'Bauteile'} · ${formatDate(s.date)}`}
                      onClick={() => openSaved(s)}
                    />
                  ))}
                </RowGroup>
                <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
                  Gemerkte Aufnahmen öffnen sich sofort – ohne neue KI-Anfrage.
                </p>
              </section>
            )}

            {error && (
              <Card className="border-danger/30">
                <p className="text-[13px] text-danger">{error}</p>
              </Card>
            )}

            <Card>
              <p className="mb-2 text-[13px] font-semibold">So wird das Ergebnis gut</p>
              <ul className="space-y-1.5">
                {[
                  'Motorhaube ganz öffnen und die Abdeckung abnehmen, wenn möglich',
                  'Bei Tageslicht fotografieren, nicht gegen die Sonne',
                  'Etwa einen Meter Abstand – der ganze Bereich soll drauf sein',
                  'Handy waagerecht halten, damit nichts abgeschnitten wird',
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-[13px] text-ink-muted">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-teal" />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>

            <Link to="/manual">
              <Button variant="ghost" full>
                Stattdessen die Schemaansicht öffnen
              </Button>
            </Link>
          </>
        ) : (
          <>
            {/* Bild mit Markern */}
            <Card padded={false} className="overflow-hidden">
              <div className="relative">
                <img src={image} alt="Dein Foto" className="w-full" />

                {result?.parts.map((p, i) => (
                  <button
                    key={`${p.label}-${i}`}
                    type="button"
                    aria-label={p.label}
                    onClick={() => setActive(active === i ? null : i)}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${clamp(p.x)}%`, top: `${clamp(p.y)}%` }}
                  >
                    <span className="relative grid h-9 w-9 place-items-center">
                      {active !== i && (
                        <span
                          className="absolute inset-0 rounded-full bg-brand-teal/40"
                          style={{ animation: 'meraq-pulse-ring 2.6s ease-out infinite' }}
                        />
                      )}
                      <span
                        className={cn(
                          'relative grid h-7 w-7 place-items-center rounded-full border-2 text-[12px] font-bold shadow-lg transition',
                          active === i
                            ? 'scale-125 border-white bg-brand-blue text-white'
                            : 'border-white/70 bg-brand-teal text-[#04121a]',
                        )}
                      >
                        {i + 1}
                      </span>
                    </span>
                  </button>
                ))}

                {loading && (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <Sparkles size={30} className="animate-pulse text-brand-violet" />
                      <p className="text-[13.5px] font-medium">Bauteile werden erkannt…</p>
                    </div>
                  </div>
                )}
              </div>

              {result && (
                <div className="border-t border-white/8 px-4 py-3">
                  <p className="text-[12.5px] text-ink-muted">{result.scene}</p>
                </div>
              )}
            </Card>

            {!result && !loading && (
              <>
                <div className="relative">
                  <Search size={17} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Suchst Du etwas Bestimmtes? (optional)"
                    className="pl-10"
                  />
                </div>
                <Button size="lg" full icon={<Sparkles size={19} />} onClick={analyse}>
                  Bauteile erkennen
                </Button>
              </>
            )}

            {error && (
              <Card className="border-danger/30">
                <p className="text-[13px] text-danger">{error}</p>
                {!hasApiKey() && (
                  <Link to="/settings" className="mt-2 inline-block text-[13px] font-medium text-brand-blue">
                    API-Schlüssel eintragen
                  </Link>
                )}
              </Card>
            )}

            {/* Liste der erkannten Teile */}
            {result && result.parts.length > 0 && (
              <div className="space-y-2.5">
                {result.parts.map((p, i) => (
                  <button
                    key={`${p.label}-list-${i}`}
                    type="button"
                    onClick={() => setActive(active === i ? null : i)}
                    className={cn(
                      'glass w-full rounded-[18px] p-3.5 text-left transition',
                      active === i ? 'border-brand-blue/50 bg-white/7' : 'active:scale-[.99]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold',
                          active === i ? 'bg-brand-blue text-white' : 'bg-brand-teal/20 text-brand-teal',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[14.5px] font-semibold">{p.label}</span>
                          <Badge tone={CONFIDENCE_TONE[p.confidence]}>{p.confidence}</Badge>
                        </span>
                        <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-muted">
                          {p.fn}
                        </span>

                        {active === i && (
                          <span className="anim-fade mt-3 block space-y-2.5 border-t border-white/8 pt-3">
                            <span className="block">
                              <span className="block text-[11.5px] font-semibold text-ink-faint">
                                Im Bild erkennst Du es so
                              </span>
                              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                                {p.looksLike}
                              </span>
                            </span>
                            {p.problems && p.problems.length > 0 && (
                              <span className="block">
                                <span className="block text-[11.5px] font-semibold text-ink-faint">
                                  Typische Probleme
                                </span>
                                <span className="mt-1 block space-y-1">
                                  {p.problems.map((prob) => (
                                    <span key={prob} className="flex gap-2 text-[12.5px] text-ink-muted">
                                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" />
                                      {prob}
                                    </span>
                                  ))}
                                </span>
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {result?.note && (
              <Card>
                <div className="flex items-start gap-2.5">
                  <Info size={16} className="mt-0.5 shrink-0 text-brand-blue" />
                  <p className="text-[12.5px] leading-relaxed text-ink-muted">{result.note}</p>
                </div>
              </Card>
            )}

            {result && result.parts.length > 0 && !openScan && (
              <Button
                full
                variant={saved ? 'outline' : 'primary'}
                icon={saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                onClick={save}
                disabled={saved}
              >
                {saved ? 'Am Fahrzeug gemerkt' : 'Aufnahme am Fahrzeug merken'}
              </Button>
            )}

            {result && (
              <>
                <EstimateNote>
                  Die Markierungen sind <strong className="text-ink">ungefähre Positionen</strong> –
                  die KI schätzt sie aus dem Bild und trifft nicht jeden Punkt genau. Verlass Dich auf
                  die Beschreibung unter „Im Bild erkennst Du es so". Was als{' '}
                  <strong className="text-ink">unsicher</strong> markiert ist, solltest Du vor dem
                  Schrauben gegenprüfen. Bei Bremsen, Airbag und Lenkung entscheidet immer die Werkstatt.
                </EstimateNote>
                <Button variant="outline" full icon={<Camera size={17} />} onClick={reset}>
                  Anderes Foto aufnehmen
                </Button>
                {openScan && (
                  <Button
                    variant="ghost"
                    full
                    icon={<Trash2 size={16} />}
                    onClick={() => removeSaved(openScan)}
                  >
                    Aufnahme nicht mehr merken
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Page>
  )
}

/** Marker am Rand halten, damit sie nicht aus dem Bild ragen */
function clamp(v: number) {
  return Math.min(94, Math.max(6, v))
}
