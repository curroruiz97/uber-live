import { useMemo, useState } from 'react'
import { Link2, Wand2, Loader2, Check, AlertTriangle } from 'lucide-react'
import { useSchedules } from '../../state/schedules'
import { useToast } from '../../state/toast'
import Dropdown from '../common/Dropdown'
import SectionCard from './SectionCard'

// Panel de vinculación: nombres de turno sin teléfono ↔ identidades reales (roster de actividad).
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
  const hasActivity = candidateOptions.length > 0
  const withSuggestion = useMemo(() => suggestions.filter((u) => u.suggestions.length === 1).length, [suggestions])

  // Todos vinculados.
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
    if (!hasActivity) {
      toast({ type: 'info', title: 'Sube primero la actividad', message: 'Sin CSV de actividad importado no hay teléfonos con los que cruzar los nombres.' })
      return
    }
    setBusy(true)
    try {
      const res = await autoLink()
      toast({
        type: res.links_upserted ? 'success' : 'info',
        title: 'Auto-emparejado',
        message: res.demo ? 'Modo demo.' : `${res.links_upserted || 0} de ${res.attempted || 0} vinculados automáticamente`,
      })
    } catch (e) {
      toast({ type: 'error', title: 'Error', message: e.message })
    }
    setBusy(false)
  }

  async function doLink(name, provider, cand) {
    if (!cand) return
    setBusy(true)
    try {
      await linkOne(name, provider, { rider_key: cand.riderKey ?? cand.rider_key, name: cand.name, phone: cand.phone })
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
      subtitle={hasActivity ? `${suggestions.length} sin emparejar · ${withSuggestion} con sugerencia` : `${suggestions.length} sin emparejar`}
      right={
        canEdit ? (
          <button onClick={doAuto} disabled={busy || !hasActivity} title={hasActivity ? '' : 'Sube primero la actividad'} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Auto-emparejar
          </button>
        ) : null
      }
      bodyClass="p-0"
    >
      {!hasActivity && (
        <div className="flex items-start gap-2.5 border-b border-line bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-muted">
            Aún no hay actividad importada. <span className="font-medium text-fg">Sube primero los CSV</span> (arriba):
            de ahí salen los teléfonos con los que se cruzan estos nombres. Después pulsa <span className="font-medium text-fg">Auto-emparejar</span>.
          </p>
        </div>
      )}
      <div className="divide-y divide-line">
        {suggestions.map((u) => (
          <div key={`${u.provider}|${u.rider_name}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">{u.rider_name}</p>
              {u.suggestions.length > 0 ? (
                <p className="truncate text-[11px] text-faint">
                  sugerencia: {u.suggestions[0].name} {u.suggestions[0].phone ? `· ${u.suggestions[0].phone}` : ''}
                  {u.suggestions[0].method === 'auto_token' ? ' (parcial)' : ''}
                </p>
              ) : (
                <p className="text-[11px] text-faint">{hasActivity ? 'sin coincidencia automática' : 'pendiente de actividad'}</p>
              )}
            </div>
            {canEdit && hasActivity && (
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
