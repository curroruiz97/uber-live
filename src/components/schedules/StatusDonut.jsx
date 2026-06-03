import { STATUS_META, STATUS_ORDER } from './statusMeta'

// Donut de distribución por estado (cumple/tarde/incompleto/ausente) + leyenda.
export default function StatusDonut({ breakdown, size = 132, thickness = 15 }) {
  const total = breakdown?.total || 0
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  let acc = 0
  const segs = STATUS_ORDER.map((k) => {
    const value = breakdown?.[k] || 0
    const frac = total ? value / total : 0
    const seg = { k, value, dash: frac * c, offset: acc }
    acc += frac * c
    return seg
  })
  const cumplePct = total ? Math.round(((breakdown.cumple || 0) / total) * 100) : 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgb(var(--c-inset))" strokeWidth={thickness} />
          {total > 0 &&
            segs.map((s) =>
              s.value > 0 ? (
                <circle
                  key={s.k}
                  cx={cx}
                  cy={cx}
                  r={r}
                  fill="none"
                  stroke={STATUS_META[s.k].hex}
                  strokeWidth={thickness}
                  strokeDasharray={`${s.dash} ${c - s.dash}`}
                  strokeDashoffset={-s.offset}
                />
              ) : null,
            )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums text-fg">{cumplePct}%</span>
          <span className="text-[10px] text-faint">cumple</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {STATUS_ORDER.map((k) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: STATUS_META[k].hex }} />
            <span className="flex-1 truncate text-muted">{STATUS_META[k].label}</span>
            <span className="font-semibold tabular-nums text-fg">{breakdown?.[k] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
