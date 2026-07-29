import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Box,
  Calculator,
  Car,
  CheckCircle2,
  FileText,
  Folder,
  Infinity as InfinityIcon,
  Send,
  Shield,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { InfinityMark, VehicleSilhouette } from '../../components/Brand'
import { Button, cn } from '../../components/ui'
import { useAppStore } from '../../store/useAppStore'

const FEATURES = [
  { icon: Activity, label: 'Diagnose' },
  { icon: Box, label: '3D Handbuch' },
  { icon: BookOpen, label: 'Anleitungen' },
  { icon: Wrench, label: 'Wartung' },
  { icon: TrendingUp, label: 'Kosten & Marktwert' },
  { icon: ShoppingCart, label: 'Teile & Preise' },
  { icon: Folder, label: 'Dokumente' },
  { icon: Calculator, label: 'Reparaturkosten' },
  { icon: Shield, label: 'Versicherung' },
  { icon: InfinityIcon, label: 'KI Assistent' },
  { icon: Car, label: 'Fahrzeugdaten' },
  { icon: FileText, label: 'und vieles mehr' },
]

const SAMPLE_QUESTIONS = [
  'Was bedeutet diese Warnleuchte?',
  'Wie wechsle ich den Ölfilter?',
  'Ist mein Auto noch viel Wert?',
  'Warum ruckelt mein Auto?',
]

export default function OnboardingScreen() {
  const navigate = useNavigate()
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)

  // Ladebalken des Startbildschirms
  useEffect(() => {
    if (step !== 0) return
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer)
          setTimeout(() => setStep(1), 250)
          return 100
        }
        return p + 4
      })
    }, 40)
    return () => clearInterval(timer)
  }, [step])

  const finish = () => {
    updateSettings({ onboardingDone: true })
    navigate('/', { replace: true })
  }

  const totalSlides = 4

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-6 pt-safe pb-safe">
      {step === 0 ? (
        <SplashSlide progress={progress} />
      ) : (
        <>
          <div className="flex h-12 shrink-0 items-center justify-end pt-2">
            {step < totalSlides && (
              <button
                type="button"
                onClick={finish}
                className="glass rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-ink-muted"
              >
                Überspringen
              </button>
            )}
          </div>

          <div key={step} className="anim-fade-up flex flex-1 flex-col justify-center py-4">
            {step === 1 && <WelcomeSlide />}
            {step === 2 && <FeaturesSlide />}
            {step === 3 && <AssistantSlide />}
            {step === 4 && <ReadySlide />}
          </div>

          <div className="shrink-0 space-y-4 pb-6">
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: totalSlides }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i + 1 === step ? 'w-5 bg-brand-blue' : 'w-1.5 bg-white/20',
                  )}
                />
              ))}
            </div>

            {step < totalSlides ? (
              <Button size="lg" full onClick={() => setStep(step + 1)}>
                Weiter
              </Button>
            ) : (
              <div className="space-y-3">
                <Button size="lg" full onClick={finish}>
                  App starten
                </Button>
                <button
                  type="button"
                  onClick={finish}
                  className="w-full py-2 text-center text-[13.5px] font-medium text-brand-blue"
                >
                  Ich richte mein Fahrzeug später ein
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SplashSlide({ progress }: { progress: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="anim-fade-up flex flex-col items-center">
        <div className="relative mb-6">
          <span className="absolute inset-0 -m-8 rounded-full bg-brand-blue/20 blur-3xl" />
          <InfinityMark size={54} className="relative" />
        </div>
        <h1 className="text-[34px] font-extrabold tracking-[0.3em] text-ink">MERAQ</h1>
        <p className="mt-1 text-[13px] font-semibold tracking-[0.42em] brand-text">AUTO AI</p>
        <p className="mt-4 text-[12px] font-medium tracking-[0.15em] text-ink-faint uppercase">
          Mehr Leben. Weniger Stress.
        </p>
      </div>

      <VehicleSilhouette className="my-10 w-[78%] opacity-90" />

      <div className="w-full max-w-[300px]">
        <p className="mb-3 text-center text-[13px] text-ink-muted">App wird gestartet…</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="brand-gradient h-full rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="tnum mt-2 text-center text-[12px] text-ink-faint">{progress}%</p>
      </div>
    </div>
  )
}

function WelcomeSlide() {
  const items = [
    { icon: Car, title: 'Alles über Dein Fahrzeug', text: 'Handbuch, Wartung, Diagnose und mehr.' },
    { icon: TrendingUp, title: 'Smarte Einblicke', text: 'Marktwert, Kosten, Analysen und Empfehlungen.' },
    { icon: Shield, title: 'Deine Daten bleiben bei Dir', text: 'Alles wird nur auf diesem Gerät gespeichert.' },
  ]
  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="relative grid h-32 w-32 place-items-center">
          <span className="absolute inset-0 rounded-full border-2 border-brand-blue/50" />
          <span className="absolute inset-0 rounded-full bg-brand-violet/25 blur-2xl" />
          <InfinityMark size={34} className="relative" />
        </div>
      </div>
      <h2 className="text-center text-[27px] leading-tight font-bold">
        Willkommen bei
        <br />
        <span className="brand-text">MERAQ Auto AI</span>
      </h2>
      <p className="mx-auto mt-3 max-w-[30ch] text-center text-[14.5px] text-ink-muted">
        Dein intelligenter Begleiter für alle Fahrzeuge.
      </p>

      <div className="mt-8 space-y-3">
        {items.map(({ icon: Icon, title, text }) => (
          <div key={title} className="glass flex items-start gap-3 rounded-[18px] p-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-white/6 text-brand-teal">
              <Icon size={21} />
            </span>
            <span>
              <span className="block text-[14.5px] font-semibold">{title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{text}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeaturesSlide() {
  return (
    <div>
      <h2 className="text-center text-[26px] leading-tight font-bold">
        Alles, was Du brauchst.
        <br />
        <span className="brand-text">In einer App.</span>
      </h2>
      <div className="mt-8 grid grid-cols-3 gap-2.5">
        {FEATURES.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="glass flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-[16px] p-2"
          >
            <Icon size={21} className="text-brand-teal" />
            <span className="text-center text-[10.5px] leading-tight font-medium text-ink-muted">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AssistantSlide() {
  return (
    <div>
      <div className="mb-7 flex justify-center">
        <div className="glass-strong relative grid h-28 w-28 place-items-center rounded-[32px]">
          <span className="absolute inset-0 rounded-[32px] bg-brand-violet/25 blur-2xl" />
          <Sparkles size={44} className="relative text-brand-violet" />
        </div>
      </div>
      <h2 className="text-center text-[26px] leading-tight font-bold">
        Dein KI Assistent
        <br />
        ist immer <span className="brand-text">für Dich da.</span>
      </h2>
      <p className="mx-auto mt-3 max-w-[32ch] text-center text-[14px] text-ink-muted">
        Stelle Fragen, erhalte Antworten und hilfreiche Tipps – jederzeit.
      </p>
      <div className="mt-7 space-y-2.5">
        {SAMPLE_QUESTIONS.map((q) => (
          <div
            key={q}
            className="glass flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-[13.5px]"
          >
            <span className="text-ink">{q}</span>
            <Send size={15} className="shrink-0 text-brand-blue" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ReadySlide() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-8 grid h-36 w-36 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-ok/60" />
        <span className="absolute inset-0 rounded-full bg-ok/20 blur-2xl" />
        <CheckCircle2 size={62} className="relative text-ok" strokeWidth={1.6} />
      </div>
      <h2 className="text-[30px] font-bold">Los geht's!</h2>
      <p className="mt-3 max-w-[30ch] text-center text-[14.5px] text-ink-muted">
        Zum Start ist ein Beispielfahrzeug hinterlegt. Du kannst es jederzeit gegen Dein eigenes tauschen.
      </p>
    </div>
  )
}
