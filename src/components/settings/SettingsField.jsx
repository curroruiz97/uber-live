import clsx from 'clsx'

// Campo de formulario estándar de Configuración: label + input + ayuda/error.
export default function SettingsField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  mono,
  disabled,
  invalid,
  maxLength,
  autoComplete,
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-xs font-medium text-muted">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className={clsx(
          'w-full rounded-lg border bg-inset px-3 py-2.5 text-sm text-fg placeholder-faint outline-none transition focus:ring-2 focus:ring-accent/20 disabled:opacity-60',
          mono && 'font-mono',
          invalid ? 'border-red-500/50 focus:border-red-500/60' : 'border-line focus:border-accent/60',
        )}
      />
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}

export function SettingsCard({ icon: Icon, title, subtitle, children, right }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold text-fg">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}
