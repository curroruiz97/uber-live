import { useState } from 'react'
import { Building2, Loader2, ArrowRight, LogOut, ShieldCheck, Palette, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../state/AuthContext'
import { useOrg } from '../../state/OrgContext'
import AuthShell from './AuthShell'

export default function CreateOrgWizard() {
  const { signOut, user } = useAuth()
  const { reload } = useOrg()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('create_organization', { p_name: name.trim() })
    if (err) {
      setBusy(false)
      setError(err.message)
      return
    }
    await reload() // el usuario pasa a tener organización → el gate muestra la app
  }

  return (
    <AuthShell subtitle={null} maxWidth="max-w-lg">
      <div className="rounded-2xl border border-line bg-panel/95 p-7 shadow-2xl shadow-black/10 ring-1 ring-accent/10 backdrop-blur sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-fg">Crea tu empresa</h2>
          <p className="mt-1.5 text-sm text-muted">Empieza tu prueba gratuita de 14 días. Podrás invitar a tu equipo después.</p>
        </div>

        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted">Nombre de la empresa</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi Flota S.L."
              autoFocus
              required
              className="w-full rounded-lg border border-line bg-inset px-3.5 py-3 text-sm text-fg placeholder-faint outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : <>Crear empresa y empezar <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[{ i: ShieldCheck, t: 'Tus APIs' }, { i: Palette, t: 'Tu marca' }, { i: Users, t: 'Tu equipo' }].map(({ i: Icon, t }) => (
            <div key={t} className="rounded-lg border border-line bg-inset/40 p-3">
              <Icon className="mx-auto h-4 w-4 text-accent" />
              <p className="mt-1 text-[11px] text-muted">{t}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Sesión: {user?.email} ·{' '}
          <button onClick={signOut} className="inline-flex items-center gap-1 text-muted transition hover:text-fg">
            <LogOut className="h-3 w-3" /> Cerrar sesión
          </button>
        </p>
      </div>
    </AuthShell>
  )
}
