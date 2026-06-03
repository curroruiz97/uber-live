import clsx from 'clsx'

// Tarjeta de sección con cabecera (icono + título + subtítulo + acción a la derecha).
export default function SectionCard({ icon: Icon, title, subtitle, right, children, bodyClass, className }) {
  return (
    <section className={clsx('overflow-hidden rounded-2xl border border-line bg-panel shadow-elev-1', className)}>
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="truncate text-[11px] text-faint">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={clsx('p-4', bodyClass)}>{children}</div>
    </section>
  )
}
