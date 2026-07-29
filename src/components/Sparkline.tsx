/**
 * Leichtgewichtige Verlaufskurve für die Startseite.
 * Bewusst ohne Chart-Bibliothek – die kostet ~50 kB und wird nur auf dem
 * Marktwert-Screen wirklich gebraucht.
 */
export function Sparkline({
  values,
  height = 86,
  color = '#3B82F6',
}: {
  values: number[]
  height?: number
  color?: string
}) {
  if (values.length < 2) return <div style={{ height }} />

  const width = 300
  const pad = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const gradientId = `spark-${color.replace('#', '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height, width: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={width} cy={y(values[values.length - 1])} r="3" fill={color} />
    </svg>
  )
}
