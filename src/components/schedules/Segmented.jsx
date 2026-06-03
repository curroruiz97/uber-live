import clsx from 'clsx'
import { selection } from '../../native/haptics'

// Control segmentado genérico. options: [{ id, label, icon? }].
export default function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div className={clsx('inline-flex items-center gap-1 rounded-lg bg-inset p-1', className)}>
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
              'inline-flex items-center gap-1.5 rounded-md font-medium transition',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              on ? 'bg-panel text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
