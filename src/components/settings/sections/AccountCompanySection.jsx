import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { User, Building2, Lock, Palette, Save, Loader2, ShieldAlert, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../state/AuthContext'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { ThemeSegmented } from '../../common/ThemeToggle'
import SettingsField, { SettingsCard } from '../SettingsField'
import Avatar from '../Avatar'

const ROLE_LABEL = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' }

export default function AccountCompanySection() {
  const { user } = useAuth()
  const { currentOrg, isOwnerOrAdmin, role, reload, switchOrg } = useOrg()
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [name, setName] = useState(currentOrg?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle().then(({ data }) => setFullName(data?.full_name || ''))
  }, [user?.id])

  useEffect(() => setName(currentOrg?.name || ''), [currentOrg?.name])

  async function saveProfile() {
    setSavingProfile(true)
    const { error } = await supabase.from('profiles').upsert({ id: user.id, email: user.email, full_name: fullName.trim() }, { onConflict: 'id' })
    setSavingProfile(false)
    toast(error ? { type: 'error', title: 'Error', message: error.message } : { type: 'success', title: 'Perfil actualizado' })
  }

  async function saveName() {
    if (!name.trim()) return
    setSavingName(true)
    const { error } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', currentOrg.id)
    setSavingName(false)
    if (error) toast({ type: 'error', title: 'No se pudo guardar', message: error.message })
    else { toast({ type: 'success', title: 'Empresa actualizada' }); reload() }
  }

  async function changePw() {
    if (pw.length < 6) return toast({ type: 'warning', title: 'Contraseña muy corta', message: 'Mínimo 6 caracteres.' })
    if (pw !== pw2) return toast({ type: 'warning', title: 'Las contraseñas no coinciden' })
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setSavingPw(false)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else { toast({ type: 'success', title: 'Contraseña actualizada' }); setPw(''); setPw2('') }
  }

  async function deleteOrg() {
    setDeleting(true)
    const { error } = await supabase.rpc('delete_organization', { p_org: currentOrg.id })
    setDeleting(false)
    if (error) return toast({ type: 'error', title: 'No se pudo eliminar', message: error.message })
    toast({ type: 'success', title: 'Empresa eliminada' })
    switchOrg('')
    reload()
  }

  return (
    <div className="space-y-4">
      {/* Perfil */}
      <SettingsCard icon={User} title="Tu perfil" subtitle="Cómo apareces ante tu equipo">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} email={user?.email} size="h-14 w-14" className="!text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{fullName || user?.email}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
            <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">{ROLE_LABEL[role] || role}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Nombre completo" value={fullName} onChange={setFullName} placeholder="Tu nombre" />
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar perfil
        </button>
      </SettingsCard>

      {/* Empresa */}
      <SettingsCard icon={Building2} title="Empresa" subtitle="Datos de tu organización">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Nombre de la empresa" value={name} onChange={setName} disabled={!isOwnerOrAdmin} placeholder="Mi Empresa S.L." />
          <SettingsField label="Identificador (slug)" value={currentOrg?.slug || ''} onChange={() => {}} disabled mono hint="Se genera automáticamente." />
        </div>
        {isOwnerOrAdmin && (
          <button onClick={saveName} disabled={savingName || name.trim() === currentOrg?.name} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        )}
      </SettingsCard>

      {/* Seguridad */}
      <SettingsCard icon={Lock} title="Seguridad" subtitle="Cambia tu contraseña">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Nueva contraseña" type="password" value={pw} onChange={setPw} placeholder="••••••••" autoComplete="new-password" />
          <SettingsField label="Repite la contraseña" type="password" value={pw2} onChange={setPw2} placeholder="••••••••" autoComplete="new-password" />
        </div>
        <button onClick={changePw} disabled={savingPw || !pw} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-fg transition hover:bg-inset disabled:opacity-50">
          {savingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Cambiar contraseña
        </button>
      </SettingsCard>

      {/* Apariencia */}
      <SettingsCard icon={Palette} title="Apariencia" subtitle="Tema de la interfaz (preferencia personal)">
        <ThemeSegmented />
      </SettingsCard>

      {/* Zona de peligro (solo owner) */}
      {role === 'owner' && (
        <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500"><ShieldAlert className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-semibold text-fg">Zona de peligro</h3>
              <p className="text-xs text-muted">Eliminar la empresa borra todos sus datos de forma permanente.</p>
            </div>
          </div>
          {!dangerOpen ? (
            <button onClick={() => setDangerOpen(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3.5 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" /> Eliminar empresa
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted">Escribe <strong className="text-fg">{currentOrg?.name}</strong> para confirmar:</p>
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="w-full max-w-sm rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-red-500/60" />
              <div className="flex gap-2">
                <button onClick={() => { setDangerOpen(false); setConfirmName('') }} className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:bg-inset">Cancelar</button>
                <button onClick={deleteOrg} disabled={deleting || confirmName !== currentOrg?.name} className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Eliminar definitivamente
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
