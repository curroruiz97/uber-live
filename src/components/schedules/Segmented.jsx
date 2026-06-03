import clsx from 'clsx'
import { selection } from '../../native/haptics'

// Control segmentado genérico. options: [{ id, label, icon? }].
// fullWidth: ocupa todo el ancho con columnas iguales (botones de lado a lado).
export default function Segmented({ options, value, onChange, className, size = 'md', fullWidth = false }) {
  return (
    <div
      className={clsx(
        'rounded-lg bg-inset p-1',
        fullWidth ? 'flex w-full gap-1' : 'inline-flex items-center gap-1',
        className,
      )}
    >
      {options.map((o) => {
        const on = value === o.id
        const Icon = o.icon
        return (
          <button
            key={o.id}
            onClick={() => {
              if (!on) {
                selection()
                onChange(o.id)
              }
            }}
            aria-pressed={on}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition',
              fullWidth && 'flex-1',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
