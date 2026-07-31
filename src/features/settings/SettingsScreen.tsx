import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Page, PageHeader } from '../../app/AppShell'
import { Button, Card, Field, Input, SectionTitle, Select, cn } from '../../components/ui'
import { useAppStore, type AiModel } from '../../store/useAppStore'
import { verifyApiKey } from '../../lib/ai/client'
import { clearFiles } from '../../lib/fileStore'

const MODELS: { value: AiModel; label: string; hint: string }[] = [
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5', hint: 'Empfohlen – schnell und stark' },
  { value: 'claude-opus-5', label: 'Claude Opus 5', hint: 'Beste Qualität, höhere Kosten' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', hint: 'Am günstigsten' },
]

export default function SettingsScreen() {
  const { settings, updateSettings, resetAll } = useAppStore()
  const [key, setKey] = useState(settings.apiKey)
  const [show, setShow] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const saveAndVerify = async () => {
    const trimmed = key.trim()
    updateSettings({ apiKey: trimmed })
    if (!trimmed) {
      setResult(null)
      return
    }
    setChecking(true)
    setResult(await verifyApiKey(trimmed, settings.model))
    setChecking(false)
  }

  const exportData = () => {
    const state = useAppStore.getState()
    const data = {
      exportedAt: new Date().toISOString(),
      vehicles: state.vehicles,
      maintenance: state.maintenance,
      activities: state.activities,
      diagnoses: state.diagnoses,
      documents: state.documents,
      // Der API-Schlüssel wird bewusst NICHT exportiert
      settings: { ...state.settings, apiKey: '' },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meraq-daten-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doReset = async () => {
    await clearFiles()
    resetAll()
    setConfirmReset(false)
    setKey('')
    setResult(null)
  }

  return (
    <Page>
      <PageHeader title="Einstellungen" backTo="/" />

      <div className="space-y-7">
        <section>
          <SectionTitle title="KI-Assistent" />
          <Card>
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-violet/15 text-brand-violet">
                <Sparkles size={19} />
              </span>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                Der Assistent läuft mit Deinem eigenen Anthropic-Schlüssel. Er wird nur in diesem Browser
                gespeichert und direkt an Anthropic geschickt – MERAQ hat keinen Server, der ihn sehen könnte.
              </p>
            </div>

            <Field label="API-Schlüssel" hint="Beginnt mit sk-ant-. Erstellbar unter console.anthropic.com">
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value)
                    setResult(null)
                  }}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="pr-11 font-mono text-[13px]"
                />
                <button
                  type="button"
                  aria-label={show ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                  onClick={() => setShow(!show)}
                  className="absolute top-1/2 right-2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-faint active:bg-white/8"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>

            <div className="mt-3 flex gap-2">
              <Button onClick={saveAndVerify} loading={checking} icon={<KeyRound size={16} />} full>
                Speichern & prüfen
              </Button>
            </div>

            {result && (
              <div
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12.5px] leading-snug',
                  result.ok
                    ? 'bg-ok/12 text-ok'
                    : 'bg-danger/12 text-danger',
                )}
              >
                {result.ok ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                )}
                {result.message}
              </div>
            )}

            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-blue"
            >
              Schlüssel bei Anthropic erstellen
              <ExternalLink size={14} />
            </a>

            <div className="mt-5 border-t border-white/8 pt-4">
              <Field label="Modell">
                <Select
                  value={settings.model}
                  onChange={(e) => updateSettings({ model: e.target.value as AiModel })}
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} – {m.hint}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle title="Persönliches" />
          <Card className="space-y-4">
            <Field label="Dein Name" hint="Wird auf der Startseite zur Begrüßung genutzt">
              <Input
                value={settings.userName}
                onChange={(e) => updateSettings({ userName: e.target.value })}
                placeholder="z. B. Max"
              />
            </Field>
            <Field label="Werkstatt-Stundensatz" hint="Basis für die Reparaturkosten-Kalkulation">
              <Input
                type="number"
                inputMode="numeric"
                min={40}
                max={300}
                value={settings.hourlyRateEur}
                onChange={(e) => updateSettings({ hourlyRateEur: Number(e.target.value) || 110 })}
              />
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle title="Fahrzeugbild" />
          <Card>
            <button
              type="button"
              onClick={() => updateSettings({ webImages: !settings.webImages })}
              className="flex min-h-[44px] w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Foto automatisch suchen</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-muted">
                  Holt einmalig ein frei lizenziertes Foto Deines Modells von Wikimedia Commons
                  und legt es auf dem Gerät ab. Dabei erfährt Wikimedia, welches Modell Du fährst.
                  Ein eigenes Foto hat immer Vorrang.
                </span>
              </span>
              <span
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition',
                  settings.webImages ? 'bg-brand-blue' : 'bg-white/15',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all',
                    settings.webImages ? 'left-[22px]' : 'left-0.5',
                  )}
                />
              </span>
            </button>
          </Card>
        </section>

        <section>
          <SectionTitle title="Daten" />
          <Card className="space-y-3">
            <div className="flex items-start gap-3">
              <ShieldCheck size={19} className="mt-0.5 shrink-0 text-ok" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                Fahrzeugdaten, Dokumente und Unterhaltungen liegen ausschließlich in diesem Browser.
                Es gibt keinen Server und kein Konto. Löschst Du die Browserdaten, sind sie weg –
                deshalb lohnt sich der Export.
              </p>
            </div>
            <Button variant="outline" full icon={<Download size={17} />} onClick={exportData}>
              Daten exportieren (JSON)
            </Button>
            {confirmReset ? (
              <div className="space-y-2 rounded-xl border border-danger/30 bg-danger/8 p-3">
                <p className="text-[13px] font-medium text-danger">
                  Wirklich alles zurücksetzen? Fahrzeuge, Dokumente und Unterhaltungen werden gelöscht.
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" full onClick={doReset}>
                    Ja, löschen
                  </Button>
                  <Button variant="outline" size="sm" full onClick={() => setConfirmReset(false)}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                full
                icon={<RotateCcw size={17} />}
                onClick={() => setConfirmReset(true)}
              >
                Alles zurücksetzen
              </Button>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle title="Über MERAQ AUTO AI" />
          <Card>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              MERAQ AUTO AI ist Dein digitaler Fahrzeugbegleiter. Marktwert, Teilepreise und
              Reparaturkosten sind <strong className="text-ink">Schätzungen</strong> auf Basis
              offengelegter Formeln und Erfahrungswerte – keine verbindlichen Angebote und kein Ersatz
              für ein Gutachten. Bei sicherheitsrelevanten Themen entscheidet immer die Werkstatt.
            </p>
            <p className="mt-3 text-[11.5px] text-ink-faint">
              Mehr Leben. Weniger Stress. · Version 1.0
            </p>
          </Card>
        </section>
      </div>
    </Page>
  )
}
