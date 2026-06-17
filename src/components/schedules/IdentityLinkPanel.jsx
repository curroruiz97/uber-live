import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Link2, Wand2, Loader2, Check } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useToast } from '../../state/toast'
import Dropdown from '../common/Dropdown'
import SectionCard from './SectionCard'

// Panel de vinculación: nombres de turno sin teléfono ↔ identidades reales (roster).
export default function IdentityLinkPanel() {
  const { suggestions, roster, autoLink, linkOne, isOwnerOrAdmin, demoMode } = useSchedules()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState({}) // rider_name -> rider_key elegido en el dropdown

  const candidateOptions = useMemo(
    () => roster.map((r) => ({ id: r.riderKey, label: `${r.name}${r.phone ? ` · ${r.phone}` : ''}` })),
    [roster],
  )
  const candidateByKey = useMemo(() => new Map(roster.map((r) => [r.riderKey, r])), [roster])
  const canEdit = isOwnerOrAdmin || demoMode

  if (!suggestions.length) {
    return (
      <SectionCard icon={Link2} title="Vinculación de riders">
        <p className="flex items-center gap-2 py-3 text-xs text-muted">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> Todos los riders con turnos están vinculados a su actividad.
        </p>
      </SectionCard>
    )
  }

  async function doAuto() {
    setBusy(true)
    try {
      const res = await autoLink()
      toast({ type: res.links_upserted ? 'success' : 'info', title: 'Auto-emparejado', message: res.demo ? 'Modo demo.' : `${res.links_upserted || 0} de ${res.attempted || 0} vinculados automáticamente` })
    } catch (e) {
      toast({ type: 'error', title: 'Error', message: e.message })
    }
    setBusy(false)
  }

  async function doLink(name, provider, cand) {
    if (!cand) return
    setBusy(true)
    try {
      await linkOne(name, provider, { rider_key: cand.riderKey ?? cand.rider_key, phone: cand.phone })
      toast({ type: 'success', title: 'Vinculado', message: `${name} → ${cand.name || ''}` })
    } catch (e) {
      toast({ type: 'error', title: 'Error', message: e.message })
    }
    setBusy(false)
  }
  function doManual(name, provider) {
    return doLink(name, provider, candidateByKey.get(manual[name]))
  }

  return (
    <SectionCard
      icon={Link2}
      title="Vinculación de riders"
      subtitle={`${suggestions.length} sin emparejar`}
      right={
        canEdit ? (
          <button onClick={doAuto} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Auto-emparejar
          </button>
        ) : null
      }
      bodyClass="p-0"
    >
      <div className="divide-y divide-line">
        {suggestions.map((u) => (
          <div key={`${u.provider}|${u.rider_name}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{u.rider_name}</p>
              {u.suggestions.length > 0 ? (
                <p className="truncate text-[11px] text-faint">
                  sugerencia: {u.suggestions[0].name} {u.suggestions[0].phone ? `· ${u.suggestions[0].phone}` : ''}
                </p>
              ) : (
                <p className="text-[11px] text-faint">sin sugerencia automática</p>
              )}
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                {u.suggestions.length > 0 && (
                  <button
                    onClick={() => doLink(u.rider_name, u.provider, u.suggestions[0])}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-fg transition hover:bg-inset disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Aceptar
                  </button>
                )}
                <Dropdown
                  value={manual[u.rider_name] || ''}
                  onChange={(v) => setManual((m) => ({ ...m, [u.rider_name]: v }))}
                  options={candidateOptions}
                  placeholder="Elegir…"
                  ariaLabel="Vincular con"
                  className="w-40"
                />
                <button
                  onClick={() => doManual(u.rider_name, u.provider)}
                  disabled={busy || !manual[u.rider_name]}
                  className="inline-flex items-center gap-1 rounded-lg bg-accent/90 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
