import { useId } from 'react'
import { pctHex, shortDate } from './statusMeta'

// Gráfico de tendencia (área + línea) en SVG, sin dependencias externas.
// data: [{ date: 'YYYY-MM-DD', value: number }]. threshold dibuja una línea de umbral.
// Usa vector-effect non-scaling-stroke para que los trazos no se deformen al escalar.
export default function TrendChart({ data = [], threshold = null, color, suffix = '%', label }) {
  const id = useId()
  if (!data || data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-xs text-faint">
        Sin datos suficientes para la tendencia
      </div>
    )
  }

  const W = 720
  const H = 180
  const padX = 8
  const padY = 16
  const values = data.map((d) => d.value)
  const maxV = Math.max(100, ...values)
  const minV = Math.min(0, ...values)
  const range = maxV - minV || 1
  const stepX = (W - padX * 2) / (data.length - 1)
  const x = (i) => padX + i * stepX
  const y = (v) => padY + (1 - (v - minV) / range) * (H - padY * 2)
  const pts = data.map((d, i) => [x(i), y(d.value)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${(H - padY).toFixed(1)} L ${padX} ${(H - padY).toFixed(1)} Z`
  const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  const stroke = color || pctHex(avg)
  const last = data[data.length - 1]
  const gridlines = [0, 50, 100].filter((g) => g >= minV && g <= maxV)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 w-full sm:h-44" role="img" aria-label={label || 'Tendencia de cumplimiento'}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.30" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridlines.map((g) => (
          <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="rgb(var(--c-line))" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {threshold != null && (
          <line x1={padX} x2={W - padX} y1={y(threshold)} y2={y(threshold)} stroke={stroke} strokeWidth="1.4" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" opacity="0.55" />
        )}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
        <span className="tabular-nums">{shortDate(data[0].date)}</span>
        <span className="font-medium text-muted">media {avg}{suffix}{threshold != null ? ` · umbral ${threshold}${suffix}` : ''}</span>
        <span className="tabular-nums">{shortDate(last.date)}</span>
      </div>
    </div>
  )
}
