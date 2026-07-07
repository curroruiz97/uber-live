import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Users, UserPlus, Trash2, Loader2, Mail, Check, X, ShieldCheck, MapPin, Eye } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../state/AuthContext'
import { useOrg } from '../../../state/OrgContext'
import { useSchedules } from '../../../state/schedules'
import { useToast } from '../../../state/toast'
import { INVITE_FN_BASE, authHeaders } from '../../../config/api'
import { canonCity } from '../../../domain/compliance'
import { normalizeScope } from '../../../utils/cityScope'
import { SettingsCard } from '../SettingsField'
import Avatar from '../Avatar'

const ROLE_STYLE = {
  owner: 'bg-accent/10 text-accent',
  admin: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  member: 'bg-inset text-muted',
  viewer: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
}
const ROLE_LABEL = { owner: 'Propietario', admin: 'Administrador', member: 'Miembro', viewer: 'Visor' }

// Ciudades conocidas del proyecto (canónicas), para que el selector siempre ofrezca
// las opciones aunque aún no haya datos de actividad importados.
const KNOWN_CITIES = ['BILBAO', 'TENERIFE', 'MADRID', 'SALAMANCA', 'SANTANDER', 'ZARAGOZA', 'PAMPLONA']

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Selector de ciudades (chips toggle) para acotar el ámbito de un visor.
function CitiesPicker({ options, value, onChange, disabled }) {
  const set = new Set(value || [])
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((c) => {
        const on = set.has(c)
        return (
          <button
            key={c}
            type="button"
            disabled={disabled}
            onClick={() => {
              const next = new Set(set)
              if (on) next.delete(c)
              else next.add(c)
              onChange([...next])
            }}
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition',
              on ? 'bg-accent/15 text-accent ring-1 ring-accent/30' : 'bg-inset text-muted hover:text-fg',
              disabled && 'cursor-default opacity-60',
            )}
          >
            {c.toLowerCase()}
          </button>
        )
      })}
    </div>
  )
}

export default function TeamSection() {
  const { user } = useAuth()
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const { roster, unscheduledRiders, daily } = useSchedules()
  const { toast } = useToast()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteCities, setInviteCities] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [editScopeId, setEditScopeId] = useState(null)
  const [editCities, setEditCities] = useState([])

  // Ciudades disponibles para acotar visores: las conocidas del proyecto + las que
  // aparezcan en los datos reales (roster, actividad sin turno, cumplimiento).
  const cityOptions = useMemo(() => {
    const set = new Set(KNOWN_CITIES)
    for (const r of roster || []) { const c = canonCity(r.city); if (c) set.add(c) }
    for (const r of unscheduledRiders || []) { const c = canonCity(r.city); if (c) set.add(c) }
    for (const d of daily || []) { const c = canonCity(d.city); if (c) set.add(c) }
    return [...set].sort()
  }, [roster, unscheduledRiders, daily])

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
    // Al dejar de ser visor, el ámbito de ciudades pierde sentido: se limpia.
    const patch = role === 'viewer' ? { role } : { role, city_scope: null }
    const { error } = await supabase.from('org_members').update(patch).eq('org_id', orgId).eq('user_id', m.user_id)
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
    if (inviteRole === 'viewer' && inviteCities.length === 0) {
      return toast({ type: 'warning', title: 'Elige al menos una ciudad', message: 'Un visor debe tener al menos una ciudad asignada.' })
    }
    setBusy(true)
    try {
      const cityScope = inviteRole === 'viewer' ? normalizeScope(inviteCities) : null
      const res = await fetch(INVITE_FN_BASE, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, role: inviteRole, city_scope: cityScope }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast({ type: 'error', title: 'Error', message: body.error || 'Error al invitar' })
      } else if (body.emailSent) {
        toast({ type: 'success', title: 'Invitación enviada', message: `Se ha enviado un email a ${e}` })
        setEmail(''); setInviteCities([]); load()
      } else if (body.alreadyRegistered) {
        toast({ type: 'success', title: 'Invitación creada', message: `${e} ya tiene cuenta. Se unirá al equipo cuando inicie sesión.` })
        setEmail(''); setInviteCities([]); load()
      } else {
        toast({ type: 'success', title: 'Invitación creada' })
        setEmail(''); setInviteCities([]); load()
      }
    } catch {
      toast({ type: 'error', title: 'Error de red', message: 'No se pudo conectar con el servidor' })
    }
    setBusy(false)
  }

  // Actualiza el ámbito de ciudades de un miembro (rol visor). [] => sin restricción (todas).
  async function saveScope(m, cities) {
    const scope = normalizeScope(cities)
    const { error } = await supabase.from('org_members').update({ city_scope: scope }).eq('org_id', orgId).eq('user_id', m.user_id)
    if (error) toast({ type: 'error', title: 'No se pudo guardar', message: error.message })
    else { toast({ type: 'success', title: 'Ámbito actualizado' }); load() }
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
            {members.map((m) => {
              const scope = normalizeScope(m.city_scope)
              const canEditScope = isOwnerOrAdmin && m.role === 'viewer'
              const editing = editScopeId === m.user_id
              return (
                <div key={m.user_id} className="py-3">
                  <div className="flex items-center gap-3">
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
                        <option value="viewer">Visor</option>
                      </select>
                    ) : (
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', ROLE_STYLE[m.role])}>
                        {m.role === 'owner' && <ShieldCheck className="h-3 w-3" />}{m.role === 'viewer' && <Eye className="h-3 w-3" />}{ROLE_LABEL[m.role] || m.role}
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

                  {m.role === 'viewer' && (
                    <div className="mt-2 pl-11">
                      {editing ? (
                        <div className="space-y-2 rounded-lg border border-line bg-inset/40 p-2.5">
                          <p className="text-[11px] font-medium text-muted">Ciudades que puede ver</p>
                          <CitiesPicker options={cityOptions} value={editCities} onChange={setEditCities} />
                          <div className="flex items-center gap-2">
                            <button onClick={() => { saveScope(m, editCities); setEditScopeId(null) }} className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition hover:brightness-110">Guardar</button>
                            <button onClick={() => setEditScopeId(null)} className="rounded-md px-2.5 py-1 text-[11px] text-muted transition hover:text-fg">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[11px] text-muted">
                          <MapPin className="h-3 w-3 shrink-0 text-faint" />
                          <span className="capitalize">{scope ? scope.map((c) => c.toLowerCase()).join(', ') : 'Todas las ciudades'}</span>
                          {canEditScope && (
                            <button onClick={() => { setEditScopeId(m.user_id); setEditCities(scope || []) }} className="text-accent transition hover:underline">Editar</button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
              <option value="viewer">Visor (solo lectura)</option>
            </select>
            <button onClick={invite} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Invitar
            </button>
          </div>

          {inviteRole === 'viewer' && (
            <div className="mt-3 space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-fg">
                <Eye className="h-3.5 w-3.5 text-violet-500" /> Ciudades que podrá ver este visor
              </div>
              <CitiesPicker options={cityOptions} value={inviteCities} onChange={setInviteCities} />
              <p className="text-[11px] text-muted">Solo verá el cumplimiento y los riders de las ciudades marcadas. No podrá importar, editar turnos ni ver ajustes.</p>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted">Invitaciones pendientes ({invites.length})</p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-inset/40 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-fg">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <span className="truncate">{inv.email}</span>
                    <span className="rounded-full bg-inset px-1.5 py-0.5 text-[10px] capitalize text-faint">{ROLE_LABEL[inv.role] || inv.role}</span>
                    {inv.role === 'viewer' && normalizeScope(inv.city_scope) && (
                      <span className="hidden items-center gap-1 text-[10px] capitalize text-faint sm:inline-flex">
                        <MapPin className="h-3 w-3" />{normalizeScope(inv.city_scope).map((c) => c.toLowerCase()).join(', ')}
                      </span>
                    )}
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
