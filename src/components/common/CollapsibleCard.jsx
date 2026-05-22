import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

export default function CollapsibleCard({
  title,
  subtitle,
  icon: Icon,
  iconClass = 'bg-accent/10 text-accent',
  right,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-inset/40"
        aria-expanded={open}
      >
        {Icon && (
          <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconClass)}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        {right}
        <ChevronDown
          className={clsx('h-4 w-4 shrink-0 text-muted transition-transform duration-300', open && 'rotate-180')}
        />
      </button>
      <div className={clsx('grid transition-all duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="border-t border-line p-5">{children}</div>
        </div>
      </div>
    </section>
  )
}
