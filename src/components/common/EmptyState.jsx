export default function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {Icon && <Icon className="h-7 w-7 text-faint" />}
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-xs text-xs text-faint">{hint}</p>}
    </div>
  )
}
