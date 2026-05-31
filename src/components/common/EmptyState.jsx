export default function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex animate-fade-in flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-inset text-faint">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {hint && <p className="max-w-xs text-xs leading-relaxed text-muted">{hint}</p>}
    </div>
  )
}
