import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Users, UserPlus, Trash2, Loader2, Mail, Check, X, ShieldCheck } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../state/AuthContext'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { INVITE_FN_BASE, authHeaders } from '../../../config/api'
import { SettingsCard } from '../SettingsField'
import Avatar from '../Avatar'

const ROLE_STYLE = {
  owner: 'bg-accent/10 text-accent',
  admin: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  member: 'bg-inset text-muted',
}
const ROLE_LABEL = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro' }

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function TeamSection() {
  const { user } = useAuth()
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const { toast } = useToast()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    const [m, i] = await Promise.all([
      supabase.rpc('list_org_members', { p_org: orgId }),
      supabase.from('org_invitations').select('*').eq('org_id', orgId).eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setMembers(m.data || [])
    setInvites(i.data || [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load])

  const owners = members.filter((m) => m.role === 'owner').length

  async function changeRole(m, role) {
    if (m.role === 'owner' && role !== 'owner' && owners <= 1) {
      return toast({ type: 'warning', title: 'No permitido', message: 'Debe quedar al menos un propietario.' })
    }
    const { error } = await supabase.from('org_members').update({ role }).eq('org_id', orgId).eq('user_id', m.user_id)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else load()
  }

  async function removeMember(m) {
    setConfirmId(null)
    if (m.user_id === user?.id) return toast({ type: 'warning', title: 'No puedes eliminarte a ti mismo' })
    if (m.role === 'owner' && owners <= 1) return toast({ type: 'warning', title: 'Debe quedar un propietario' })
    const { error } = await supabase.from('org_members').delete().eq('org_id', orgId).eq('user_id', m.user_id)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else { toast({ type: 'success', title: 'Miembro eliminado' }); load() }
  }

  async function invite() {
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast({ type: 'warning', title: 'Email no válido' })
    setBusy(true)
    try {
      const res = await fetch(INVITE_FN_BASE, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, role: inviteRole }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: 'Error', message: body.error || 'Error al invitar' })
      } else if (body.emailSent) {
        toast({ type: 'success', title: 'Invitación enviada', message: `Se ha enviado un email a ${e}` })
        setEmail(''); load()
      } else if (body.alreadyRegistered) {
        toast({ type: 'success', title: 'Invitación creada', message: `${e} ya tiene cuenta. Se unirá al equipo cuando inicie sesión.` })
        setEmail(''); load()
      } else {
        toast({ type: 'success', title: 'Invitación creada' })
        setEmail(''); load()
      }
    } catch {
      toast({ type: 'error', title: 'Error de red', message: 'No se pudo conectar con el servidor' })
    }
    setBusy(false)
  }

  async function revokeInvite(id) {
    const { error } = await supabase.from('org_invitations').update({ status: 'revoked' }).eq('id', id)
    if (!error) load()
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={Users}
        title="Miembros del equipo"
        subtitle={`${members.length} ${members.length === 1 ? 'persona' : 'personas'} con acceso`}
      >
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-inset" />)}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 py-3">
                <Avatar name={m.full_name} email={m.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {m.full_name || m.email}
                    {m.user_id === user?.id && <span className="ml-1.5 text-xs font-normal text-faint">(tú)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email} · desde {fmtDate(m.created_at)}</p>
                </div>

                {isOwnerOrAdmin && m.user_id !== user?.id ? (
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m, e.target.value)}
                    className="rounded-lg border border-line bg-inset px-2 py-1 text-xs text-fg outline-none focus:border-accent/60"
                  >
                    <option value="owner">Propietario</option>
                    <option value="admin">Administrador</option>
                    <option value="member">Miembro</option>
                  </select>
                ) : (
                  <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', ROLE_STYLE[m.role])}>
                    {m.role === 'owner' && <ShieldCheck className="h-3 w-3" />}{ROLE_LABEL[m.role]}
                  </span>
                )}

                {isOwnerOrAdmin && m.user_id !== user?.id && (
                  confirmId === m.user_id ? (
                    <span className="flex items-center gap-1">
                      <button onClick={() => removeMember(m)} className="rounded-md bg-red-500/10 p-1.5 text-red-500 transition hover:bg-red-500/20" title="Confirmar"><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setConfirmId(null)} className="rounded-md p-1.5 text-faint transition hover:bg-inset hover:text-fg" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(m.user_id)} className="rounded-md p-1.5 text-faint transition hover:bg-red-500/10 hover:text-red-500" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsCard>

      {isOwnerOrAdmin && (
        <SettingsCard icon={UserPlus} title="Invitar al equipo" subtitle="Se enviará un email de invitación a la persona">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@empresa.com" className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg placeholder-faint outline-none focus:border-accent/60" />
            </div>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-lg border border-line bg-inset px-2.5 py-2.5 text-sm text-fg outline-none focus:border-accent/60">
              <option value="member">Miembro</option>
              <option value="admin">Administrador</option>
            </select>
            <button onClick={invite} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invitar
            </button>
          </div>

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted">Invitaciones pendientes ({invites.length})</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-inset/40 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-fg">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <span className="truncate">{inv.email}</span>
                    <span className="rounded-full bg-inset px-1.5 py-0.5 text-[10px] capitalize text-faint">{ROLE_LABEL[inv.role] || inv.role}</span>
                  </span>
                  <button onClick={() => revokeInvite(inv.id)} className="text-xs text-muted transition hover:text-red-500">Revocar</button>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      )}
    </div>
  )
}
