import clsx from 'clsx'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '../../state/ThemeContext'
import { selection } from '../../native/haptics'

export default function ThemeToggle() {
  const { resolved, toggle } = useTheme()
  const isDark = resolved === 'dark'
  return (
    <button
      onClick={() => {
        selection()
        toggle()
      }}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Cambiar tema"
      className="tappable rounded-lg p-1.5 text-muted transition hover:bg-inset hover:text-fg"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

const OPTIONS = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'system', label: 'Sistema', icon: Monitor },
  { id: 'dark', label: 'Oscuro', icon: Moon },
]

export function ThemeSegmented() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-lg bg-inset p-1">
      {OPTIONS.map((o) => {
        const Icon = o.icon
        const on = theme === o.id
        return (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
              on ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" />
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
