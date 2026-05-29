import clsx from 'clsx'

export function initials(value) {
  const s = String(value || '').trim()
  if (!s) return '?'
  const parts = s.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return s.slice(0, 2).toUpperCase()
}

// Avatar con iniciales y color de acento.
export default function Avatar({ name, email, size = 'h-9 w-9', className }) {
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-accent/15 font-semibold text-accent ring-1 ring-accent/25',
        size,
        className,
      )}
    >
      <span className="text-xs">{initials(name || email)}</span>
    </span>
  )
}
