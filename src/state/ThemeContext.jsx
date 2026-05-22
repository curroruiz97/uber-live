import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'ul-theme'

function getSystem() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function resolveTheme(theme) {
  return theme === 'system' ? getSystem() : theme
}
function applyTheme(resolved) {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark'
    } catch {
      return 'dark'
    }
  })
  const [resolved, setResolved] = useState(() => resolveTheme(theme))

  const setTheme = useCallback((t) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const r = resolveTheme(theme)
    setResolved(r)
    applyTheme(r)
  }, [theme])

  // Sigue los cambios del sistema cuando el modo es "system".
  useEffect(() => {
    if (theme !== 'system') return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const r = getSystem()
      setResolved(r)
      applyTheme(r)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      resolved,
      setTheme,
      toggle: () => setTheme(resolveTheme(theme) === 'dark' ? 'light' : 'dark'),
    }),
    [theme, resolved, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
