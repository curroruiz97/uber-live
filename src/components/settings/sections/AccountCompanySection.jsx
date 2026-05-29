import { useState } from 'react'
import { Building2, Lock, Palette, Save, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../state/AuthContext'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { ThemeSegmented } from '../../common/ThemeToggle'
import SettingsField, { SettingsCard } from '../SettingsField'

export default function AccountCompanySection() {
  const { user } = useAuth()
  const { currentOrg, isOwnerOrAdmin, role, reload } = useOrg()
  const { toast } = useToast()
  const [name, setName] = useState(currentOrg?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    const { error } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', currentOrg.id)
    setSavingName(false)
    if (error) toast({ type: 'error', title: 'No se pudo guardar', message: error.message })
    else {
      toast({ type: 'success', title: 'Empresa actualizada' })
      reload()
    }
  }

  async function changePw() {
    if (pw.length < 6) return toast({ type: 'warning', title: 'Contraseña muy corta', message: 'Mínimo 6 caracteres.' })
    if (pw !== pw2) return toast({ type: 'warning', title: 'Las contraseñas no coinciden' })
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else {
      toast({ type: 'success', title: 'Contraseña actualizada' })
      setPw('')
      setPw2('')
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={Building2} title="Empresa" subtitle="Datos de tu organización">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Nombre de la empresa" value={name} onChange={setName} disabled={!isOwnerOrAdmin} placeholder="Mi Empresa S.L." />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Tu rol</label>
            <div className="rounded-lg border border-line bg-inset px-3 py-2.5 text-sm capitalize text-muted">{role || '—'}</div>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <button
            onClick={saveName}
            disabled={savingName}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        )}
      </SettingsCard>

      <SettingsCard icon={Lock} title="Tu cuenta" subtitle="Acceso y contraseña">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
            <div className="truncate rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-muted">{user?.email}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Nueva contraseña" type="password" value={pw} onChange={setPw} placeholder="••••••••" autoComplete="new-password" />
          <SettingsField label="Repite la contraseña" type="password" value={pw2} onChange={setPw2} placeholder="••••••••" autoComplete="new-password" />
        </div>
        <button
          onClick={changePw}
          disabled={savingPw || !pw}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50"
        >
          {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Cambiar contraseña
        </button>
      </SettingsCard>

      <SettingsCard icon={Palette} title="Apariencia" subtitle="Tema de la interfaz (preferencia personal)">
        <ThemeSegmented />
      </SettingsCard>
    </div>
  )
}
