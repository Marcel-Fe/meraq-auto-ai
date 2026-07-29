import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { forwardRef } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

/* ---------------- Card ---------------- */

export function Card({
  className,
  children,
  padded = true,
  ...rest
}: ComponentPropsWithoutRef<'div'> & { padded?: boolean }) {
  return (
    <div
      className={cn('glass rounded-[20px]', padded && 'p-4', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  title,
  action,
  to,
}: {
  title: string
  action?: string
  to?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {action &&
        (to ? (
          <Link
            to={to}
            className="flex items-center gap-0.5 text-[13px] font-medium text-brand-blue active:opacity-70"
          >
            {action}
            <ChevronRight size={15} />
          </Link>
        ) : (
          <span className="text-[13px] text-ink-muted">{action}</span>
        ))}
    </div>
  )
}

/* ---------------- Buttons ---------------- */

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'md' | 'lg' | 'sm'
  loading?: boolean
  icon?: ReactNode
  full?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, full, className, children, disabled, ...rest },
  ref,
) {
  const sizes = {
    sm: 'h-9 px-3 text-[13px] rounded-xl',
    md: 'h-11 px-4 text-[15px] rounded-[14px]',
    lg: 'h-[52px] px-5 text-[16px] rounded-2xl',
  }
  const variants = {
    primary: 'brand-gradient text-white font-semibold shadow-[0_8px_24px_-8px_rgba(59,130,246,.7)]',
    outline: 'glass text-ink font-medium',
    ghost: 'text-ink-muted font-medium',
    danger: 'bg-danger/15 text-danger font-semibold border border-danger/30',
  }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition active:scale-[.97] disabled:opacity-50 disabled:active:scale-100',
        sizes[size],
        variants[variant],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={17} className="anim-spin" /> : icon}
      {children}
    </button>
  )
})

/* ---------------- Tiles & Stats ---------------- */

export function Tile({
  icon,
  label,
  to,
  onClick,
  accent = 'teal',
}: {
  icon: ReactNode
  label: string
  to?: string
  onClick?: () => void
  accent?: 'teal' | 'blue' | 'violet' | 'amber' | 'green'
}) {
  const colors = {
    teal: 'text-brand-teal',
    blue: 'text-brand-blue',
    violet: 'text-brand-violet',
    amber: 'text-warn',
    green: 'text-ok',
  }
  const inner = (
    <>
      <span className={cn('grid h-10 w-10 place-items-center', colors[accent])}>{icon}</span>
      <span className="text-center text-[11.5px] leading-tight font-medium text-ink-muted">
        {label}
      </span>
    </>
  )
  const cls =
    'glass flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[16px] p-2 transition active:scale-[.96]'

  if (to) return <Link to={to} className={cls}>{inner}</Link>
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export function StatTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: string
  icon?: ReactNode
  hint?: string
}) {
  return (
    <div className="glass flex-1 rounded-[16px] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="tnum text-[15px] font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>}
    </div>
  )
}

/* ---------------- Badges ---------------- */

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand'
  className?: string
}) {
  const tones = {
    neutral: 'bg-white/8 text-ink-muted border-white/10',
    ok: 'bg-ok/15 text-ok border-ok/25',
    warn: 'bg-warn/15 text-warn border-warn/25',
    danger: 'bg-danger/15 text-danger border-danger/25',
    brand: 'bg-brand-blue/15 text-brand-blue border-brand-blue/25',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Progress ---------------- */

export function ProgressBar({ value, tone = 'ok' }: { value: number; tone?: 'ok' | 'warn' | 'danger' }) {
  const colors = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' }
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', colors[tone])}
        style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }}
      />
    </div>
  )
}

/* ---------------- List rows ---------------- */

export function Row({
  icon,
  title,
  subtitle,
  right,
  to,
  onClick,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  to?: string
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/6 text-brand-teal">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium text-ink">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[12.5px] text-ink-muted">{subtitle}</span>
        )}
      </span>
      {right ?? ((to || onClick) && <ChevronRight size={17} className="shrink-0 text-ink-faint" />)}
    </>
  )
  const cls = cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/5',
    className,
  )
  if (to) return <Link to={to} className={cls}>{content}</Link>
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    )
  return <div className={cls}>{content}</div>
}

export function RowGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('glass overflow-hidden rounded-[20px] divide-y divide-white/6', className)}>
      {children}
    </div>
  )
}

/* ---------------- Empty & Loading ---------------- */

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-ink-faint">
        {icon}
      </span>
      <h3 className="mb-1 text-[16px] font-semibold text-ink">{title}</h3>
      <p className="mb-4 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-muted">{text}</p>
      {action}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />
}

/* ---------------- Inputs ---------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-faint">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-[14px] border border-white/10 bg-white/5 px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition focus:border-brand-blue/60 focus:bg-white/8'

export function Input(props: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function Select(props: ComponentPropsWithoutRef<'select'>) {
  return (
    <select
      {...props}
      className={cn(inputClass, 'appearance-none bg-surface', props.className)}
    />
  )
}

/* ---------------- Segmented control ---------------- */

type SegmentedOption<T extends string> = T | { value: T; label: string }

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  const items = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o as string } : o,
  )
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-[14px] bg-white/5 p-1', className)}>
      {items.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 shrink-0 rounded-[11px] px-3 py-2 text-[13px] font-medium whitespace-nowrap transition',
            value === o.value
              ? 'brand-gradient text-white shadow-[0_4px_14px_-6px_rgba(59,130,246,.8)]'
              : 'text-ink-muted active:bg-white/5',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Sheet (Bottom-Modal) ---------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="anim-fade absolute inset-0 bg-black/65 backdrop-blur-sm"
      />
      <div className="anim-sheet relative max-h-[88dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[26px] border-t border-white/12 bg-bg-elevated pb-safe">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/8 bg-bg-elevated/95 px-5 pt-3 pb-3 backdrop-blur">
          <div className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
          <h3 className="mt-1 truncate text-[16px] font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 shrink-0 text-[13px] font-medium text-brand-blue"
          >
            Fertig
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

/* ---------------- Hinweis auf geschätzte Werte ---------------- */

export function EstimateNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-faint">
      {children}
    </p>
  )
}
