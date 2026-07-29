import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Car, ChevronLeft, FileText, Home, MoreHorizontal, Settings } from 'lucide-react'
import { BrandLogo, InfinityMark } from '../components/Brand'
import { cn } from '../components/ui'

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/vehicle', label: 'Fahrzeug', icon: Car, end: false },
  { to: '/assistant', label: 'KI', icon: null, end: false },
  { to: '/documents', label: 'Dokumente', icon: FileText, end: false },
  { to: '/more', label: 'Mehr', icon: MoreHorizontal, end: false },
] as const

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px]">
      {/* Deckender Hintergrund: durchscheinender Text unter der Leiste wirkt unsauber */}
      <div className="border-t border-white/10 bg-[#070b14]/98 backdrop-blur-2xl pb-safe">
        <div className="grid grid-cols-5 items-end px-2 pt-2 pb-1.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[52px] flex-col items-center justify-end gap-1 rounded-xl py-1 transition',
                  isActive ? 'text-brand-blue' : 'text-ink-faint',
                )
              }
            >
              {({ isActive }) =>
                item.icon ? (
                  <>
                    <item.icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        'relative -mt-6 grid h-14 w-14 place-items-center rounded-full border transition',
                        isActive
                          ? 'brand-gradient border-white/20 shadow-[0_10px_28px_-8px_rgba(59,130,246,.9)]'
                          : 'border-white/14 bg-surface-2 shadow-[0_8px_22px_-10px_rgba(0,0,0,.9)]',
                      )}
                    >
                      <InfinityMark size={17} />
                    </span>
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                )
              }
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

/** Kopfzeile für Unterseiten mit Zurück-Pfeil */
export function PageHeader({
  title,
  subtitle,
  right,
  backTo,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  backTo?: string
}) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/6 bg-[#060910]/92 px-4 pt-safe pb-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Zurück"
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink active:bg-white/6"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-[11.5px] text-ink-muted">{subtitle}</p>}
        </div>
        <div className="flex h-10 min-w-10 shrink-0 items-center justify-end">{right}</div>
      </div>
    </header>
  )
}

/** Kopfzeile der Startseite mit Logo */
export function HomeHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/6 bg-[#060910]/92 px-4 pt-safe pb-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" aria-label="Startseite">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-1">
          {right}
          <Link
            to="/settings"
            aria-label="Einstellungen"
            className="grid h-10 w-10 place-items-center rounded-full text-ink-muted active:bg-white/6"
          >
            <Settings size={20} />
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Seitenrahmen: begrenzte Breite, Platz für die Bottom-Nav */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto min-h-dvh w-full max-w-[520px] px-4 pb-32', className)}>{children}</div>
  )
}
