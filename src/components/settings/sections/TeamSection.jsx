import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Users, UserPlus, Trash2, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../state/AuthContext'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { SettingsCard } from '../SettingsField'

const ROLES = ['owner', 'admin', 'member']

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

  useEffect(() => {
    load()
  }, [load])

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
    if (m.user_id === user?.id) return toast({ type: 'warning', title: 'No puedes eliminarte a ti mismo' })
    if (m.role === 'owner' && owners <= 1) return toast({ type: 'warning', title: 'Debe quedar un propietario' })
    const { error } = await supabase.from('org_members').delete().eq('org_id', orgId).eq('user_id', m.user_id)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else {
      toast({ type: 'success', title: 'Miembro eliminado' })
      load()
    }
  }

  async function invite() {
    const e = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast({ type: 'warning', title: 'Email no válido' })
    setBusy(true)
    const { error } = await supabase.from('org_invitations').insert({ org_id: orgId, email: e, role: inviteRole, invited_by: user?.id ?? null })
    setBusy(false)
    if (error) toast({ type: 'error', title: 'Error', message: error.message })
    else {
      toast({ type: 'success', title: 'Invitación creada', message: 'Se activará cuando esa persona se registre con ese email.' })
      setEmail('')
      load()
    }
  }

  async function revokeInvite(id) {
    const { error } = await supabase.from('org_invitations').update({ status: 'revoked' }).eq('id', id)
    if (!error) load()
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={Users} title="Miembros del equipo" subtitle={`${members.length} ${members.length === 1 ? 'persona' : 'personas'}`}>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-faint">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Rol</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.user_id} className="border-b border-line">
                    <td className="py-2.5 pr-4">
                      <span className="text-fg">{m.email}</span>
                      {m.user_id === user?.id && <span className="ml-1.5 text-xs text-faint">(tú)</span>}
                    </td>
                    <td className="py-2.5 pr-4">
                      {isOwnerOrAdmin ? (
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value)}
                          className="rounded-lg border border-line bg-inset px-2 py-1 text-xs capitalize text-fg outline-none focus:border-accent/60"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-inset px-2 py-0.5 text-xs capitalize text-muted">
                          {m.role === 'owner' && <ShieldCheck className="h-3 w-3 text-accent" />}{m.role}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {isOwnerOrAdmin && m.user_id !== user?.id && (
                        <button onClick={() => removeMember(m)} className="rounded-md p-1.5 text-faint transition hover:bg-red-500/10 hover:text-red-500" aria-label="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>

      {isOwnerOrAdmin && (
        <SettingsCard icon={UserPlus} title="Invitar al equipo" subtitle="La invitación se activa cuando la persona se registra con ese email">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg placeholder-faint outline-none focus:border-accent/60"
              />
            </div>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="rounded-lg border border-line bg-inset px-2.5 py-2.5 text-sm capitalize text-fg outline-none focus:border-accent/60">
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button onClick={invite} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invitar
            </button>
          </div>

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted">Invitaciones pendientes</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-inset/40 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-fg"><Mail className="h-3.5 w-3.5 shrink-0 text-faint" /><span className="truncate">{inv.email}</span><span className="text-xs capitalize text-faint">· {inv.role}</span></span>
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
