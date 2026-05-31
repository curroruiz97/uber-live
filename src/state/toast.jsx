import { createContext, useCallback, useContext, useState } from 'react'
import clsx from 'clsx'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { success as hSuccess, error as hError, notifyWarning } from '../native/haptics'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: AlertTriangle, info: Info }
const TONES = {
  success: 'text-emerald-500 dark:text-emerald-400',
  warning: 'text-amber-500 dark:text-amber-400',
  error: 'text-red-500 dark:text-red-400',
  info: 'text-accent',
}

let seq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (opts) => {
      seq += 1
      const id = seq
      const type = opts.type || 'info'
      // Feedback háptico acorde al tipo (no-op en web).
      if (type === 'success') hSuccess()
      else if (type === 'error') hError()
      else if (type === 'warning') notifyWarning()
      setToasts((prev) => [...prev, { id, type, ...opts }].slice(-4))
      window.setTimeout(() => remove(id), opts.duration ?? 5000)
      return id
    },
    [remove],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[100] flex flex-col gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-sm md:bottom-4">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] ?? Info
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-2xl border border-line-strong bg-elevated/95 p-3.5 shadow-elev-3 backdrop-blur-xl"
            >
              <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', TONES[t.type])} />
              <div className="min-w-0 flex-1">
                {t.title && <p className="text-sm font-medium text-fg">{t.title}</p>}
                {t.message && <p className="text-xs text-muted">{t.message}</p>}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-faint transition hover:text-fg"
                aria-label="Cerrar notificación"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
