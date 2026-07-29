/**
 * Schematische Hintergrundzeichnungen für den Bauteil-Explorer.
 * Bewusst eigene, abstrahierte Grafiken – kein Herstellerbild.
 */
export function ZoneScene({ scene }: { scene: 'engine' | 'interior' | 'chassis' }) {
  return (
    <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="scene-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1526" />
          <stop offset="100%" stopColor="#070b14" />
        </linearGradient>
        <linearGradient id="scene-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f4c63" />
          <stop offset="100%" stopColor="#1b2436" />
        </linearGradient>
        <pattern id="scene-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 L0 0 0 20" fill="none" stroke="rgba(59,130,246,.07)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width="400" height="300" fill="url(#scene-bg)" />
      <rect width="400" height="300" fill="url(#scene-grid)" />

      {scene === 'engine' && (
        <g>
          {/* Motorblock */}
          <rect x="110" y="95" width="150" height="90" rx="8" fill="url(#scene-metal)" />
          {/* Ventildeckel mit Zündspulen */}
          <rect x="120" y="72" width="130" height="30" rx="6" fill="#4a5871" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={131 + i * 30} y="60" width="18" height="16" rx="3" fill="#5b6b87" />
          ))}
          {/* Ansaugkrümmer */}
          <path
            d="M262 110 q42 -6 48 24 q4 24 -22 30"
            fill="none"
            stroke="#39465c"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Luftfilterkasten */}
          <rect x="44" y="150" width="66" height="46" rx="8" fill="#2c3648" />
          <path d="M110 172 h20" stroke="#39465c" strokeWidth="12" strokeLinecap="round" />
          {/* Batterie */}
          <rect x="272" y="160" width="70" height="46" rx="6" fill="#243043" />
          <rect x="284" y="152" width="12" height="10" rx="2" fill="#ef4444" />
          <rect x="318" y="152" width="12" height="10" rx="2" fill="#94a3b8" />
          {/* Ausgleichsbehälter */}
          <rect x="252" y="86" width="40" height="34" rx="8" fill="#1e293b" opacity=".9" />
          <rect x="318" y="76" width="34" height="30" rx="7" fill="#1e293b" opacity=".9" />
          {/* Riementrieb */}
          <circle cx="60" cy="104" r="22" fill="none" stroke="#39465c" strokeWidth="9" />
          <circle cx="60" cy="104" r="7" fill="#4a5871" />
          {/* Turbo */}
          <circle cx="180" cy="204" r="24" fill="none" stroke="#39465c" strokeWidth="10" />
          <circle cx="180" cy="204" r="8" fill="#4a5871" />
          {/* Schläuche */}
          <path d="M204 204 q40 0 48 -30" fill="none" stroke="#2c3648" strokeWidth="12" strokeLinecap="round" />
        </g>
      )}

      {scene === 'interior' && (
        <g>
          {/* Armaturenbrett */}
          <path d="M20 120 q60 -46 180 -46 q120 0 180 46 v60 h-360 z" fill="url(#scene-metal)" />
          {/* Kombiinstrument */}
          <rect x="82" y="98" width="86" height="42" rx="8" fill="#111a2b" />
          <circle cx="108" cy="119" r="13" fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity=".8" />
          <circle cx="142" cy="119" r="13" fill="none" stroke="#2dd4bf" strokeWidth="2.5" opacity=".8" />
          {/* Zentraldisplay */}
          <rect x="184" y="92" width="112" height="54" rx="8" fill="#0d1726" stroke="#1e293b" strokeWidth="2" />
          {/* Lüftungsdüsen */}
          <rect x="286" y="100" width="42" height="20" rx="10" fill="#131c2c" />
          <rect x="60" y="152" width="46" height="16" rx="8" fill="#131c2c" />
          {/* Lenkrad */}
          <ellipse cx="96" cy="196" rx="52" ry="28" fill="none" stroke="#37445a" strokeWidth="10" />
          <circle cx="96" cy="196" r="12" fill="#2b3648" />
          {/* Mittelkonsole */}
          <rect x="176" y="164" width="118" height="76" rx="10" fill="#1a2334" />
          <rect x="196" y="180" width="78" height="12" rx="6" fill="#111a2b" />
          {/* Fußraum / OBD */}
          <rect x="42" y="228" width="60" height="26" rx="6" fill="#141d2d" />
        </g>
      )}

      {scene === 'chassis' && (
        <g>
          {/* Achse */}
          <rect x="40" y="140" width="320" height="14" rx="7" fill="url(#scene-metal)" />
          {/* Räder */}
          <circle cx="96" cy="180" r="52" fill="#0a0f1a" stroke="#2b3648" strokeWidth="14" />
          <circle cx="96" cy="180" r="26" fill="none" stroke="#3d4a61" strokeWidth="6" />
          <circle cx="288" cy="180" r="52" fill="#0a0f1a" stroke="#2b3648" strokeWidth="14" />
          <circle cx="288" cy="180" r="26" fill="none" stroke="#3d4a61" strokeWidth="6" />
          {/* Bremsscheibe */}
          <circle cx="96" cy="180" r="34" fill="none" stroke="#4b5b74" strokeWidth="5" opacity=".9" />
          <path d="M74 152 a34 34 0 0 1 40 4" fill="none" stroke="#64748b" strokeWidth="9" strokeLinecap="round" />
          {/* Feder / Dämpfer */}
          <path
            d="M190 60 v20 m0 0 q-16 8 0 16 q16 8 0 16 q-16 8 0 16 q16 8 0 16 v20"
            fill="none"
            stroke="#4a5871"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <rect x="182" y="164" width="16" height="46" rx="8" fill="#39465c" />
          {/* Querlenker */}
          <path d="M140 150 L188 176 L246 150" fill="none" stroke="#39465c" strokeWidth="9" strokeLinecap="round" />
          {/* Abgasstrang */}
          <path
            d="M60 246 h130 q22 0 30 -10 h60 q20 0 26 10 h58"
            fill="none"
            stroke="#33405a"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <rect x="222" y="226" width="52" height="22" rx="11" fill="#3b4a63" />
        </g>
      )}
    </svg>
  )
}
