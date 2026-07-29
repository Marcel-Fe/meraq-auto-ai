/** Das Unendlichkeitszeichen aus dem Markenlogo, als SVG mit Farbverlauf. */
export function InfinityMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = `meraq-grad-${size}`
  return (
    <svg viewBox="0 0 64 32" width={size * 2} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Lemniskate: die beiden Schleifen überkreuzen sich in der Mitte */}
      <path
        d="M9 16 C9 5 21 5 32 16 C43 27 55 27 55 16 C55 5 43 5 32 16 C21 27 9 27 9 16 Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="4.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Kompaktes Logo mit Schriftzug für Kopfzeilen */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <InfinityMark size={16} />
      <span className="flex flex-col leading-none">
        <span className="text-[14px] font-extrabold tracking-[0.22em] text-ink">MERAQ</span>
        {!compact && (
          <span className="mt-0.5 text-[7.5px] font-semibold tracking-[0.34em] text-ink-faint">
            AUTO AI
          </span>
        )}
      </span>
    </span>
  )
}

/**
 * Stilisierte Fahrzeug-Silhouette.
 * Bewusst eine eigene Zeichnung statt eines fremden Pressefotos – der Nutzer
 * kann jederzeit ein eigenes Foto seines Fahrzeugs hinterlegen.
 */
export function VehicleSilhouette({
  kind = 'car',
  className,
}: {
  kind?: 'car' | 'motorcycle' | 'truck' | 'bus' | 'van' | 'camper'
  className?: string
}) {
  return (
    <svg viewBox="0 0 200 88" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="veh-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="55%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="veh-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity=".45" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity=".12" />
        </linearGradient>
        <radialGradient id="veh-light">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {kind === 'motorcycle' ? (
        <g>
          <circle cx="46" cy="62" r="19" fill="none" stroke="url(#veh-body)" strokeWidth="7" />
          <circle cx="152" cy="62" r="19" fill="none" stroke="url(#veh-body)" strokeWidth="7" />
          <path d="M46 62 L86 40 L124 40 L152 62" fill="none" stroke="url(#veh-body)" strokeWidth="6" strokeLinecap="round" />
          <path d="M86 40 L74 24 L96 22" fill="none" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <path d="M104 40 q18 -14 30 -4" fill="none" stroke="url(#veh-glass)" strokeWidth="9" strokeLinecap="round" />
        </g>
      ) : kind === 'truck' || kind === 'bus' || kind === 'camper' ? (
        <g>
          <rect x="18" y="20" width="164" height="42" rx="8" fill="url(#veh-body)" />
          <rect x="26" y="26" width="46" height="18" rx="4" fill="url(#veh-glass)" />
          {kind !== 'truck' && (
            <>
              <rect x="82" y="26" width="26" height="18" rx="3" fill="url(#veh-glass)" opacity=".6" />
              <rect x="116" y="26" width="26" height="18" rx="3" fill="url(#veh-glass)" opacity=".6" />
            </>
          )}
          <circle cx="52" cy="66" r="12" fill="#0f172a" stroke="#334155" strokeWidth="4" />
          <circle cx="150" cy="66" r="12" fill="#0f172a" stroke="#334155" strokeWidth="4" />
          <ellipse cx="20" cy="34" rx="12" ry="7" fill="url(#veh-light)" />
        </g>
      ) : (
        <g>
          {/* Karosserie */}
          <path
            d="M14 60 q2 -14 14 -17 l22 -4 q14 -16 34 -17 h26 q20 1 32 17 l20 5 q12 3 14 16 v6 q0 5 -6 5 h-150 q-6 0 -6 -5 z"
            fill="url(#veh-body)"
          />
          {/* Verglasung */}
          <path
            d="M56 39 q12 -13 28 -14 h24 q17 1 28 14 z"
            fill="url(#veh-glass)"
          />
          {/* Scheinwerfer */}
          <ellipse cx="26" cy="52" rx="13" ry="6" fill="url(#veh-light)" />
          <ellipse cx="174" cy="52" rx="13" ry="6" fill="url(#veh-light)" />
          {/* Räder */}
          <circle cx="54" cy="66" r="13" fill="#020617" stroke="#334155" strokeWidth="4" />
          <circle cx="146" cy="66" r="13" fill="#020617" stroke="#334155" strokeWidth="4" />
          <circle cx="54" cy="66" r="5" fill="#475569" />
          <circle cx="146" cy="66" r="5" fill="#475569" />
        </g>
      )}
    </svg>
  )
}
