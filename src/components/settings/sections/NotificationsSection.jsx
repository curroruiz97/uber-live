import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Bell } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import { SettingsCard } from '../SettingsField'

const TOGGLES = [
  { key: 'incidents', label: 'Incidencias de flota', hint: 'Avisar cuando se cancela un pedido o se abre una incidencia.' },
  { key: 'low_credit', label: 'Crédito bajo', hint: 'Avisar cuando el saldo de créditos de mensajería sea bajo.' },
  { key: 'trial_ending', label: 'Fin de prueba', hint: 'Recordatorio antes de que termine el periodo de prueba.' },
  { key: 'weekly_summary', label: 'Resumen semanal', hint: 'Recibir un resumen semanal de actividad de la flota.' },
]

function Toggle({ on, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
        on ? 'bg-accent' : 'bg-inset ring-1 ring-line',
      )}
      aria-pressed={on}
    >
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export default function NotificationsSection() {
  const { currentOrgId: orgId, isOwnerOrAdmin } = useOrg()
  const { toast } = useToast()
  const [prefs, setPrefs] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('org_settings')
      .select('notifications')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data }) => setPrefs(data?.notifications || {}))
  }, [orgId])

  async function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    const { error } = await supabase
      .from('org_settings')
      .update({ notifications: next, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
    setSaving(false)
    if (error) toast({ type: 'error', title: 'No se pudo guardar', message: error.message })
  }

  return (
    <SettingsCard icon={Bell} title="Notificaciones" subtitle="Qué avisos recibe tu equipo">
      <div className="divide-y divide-line">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{t.label}</p>
              <p className="text-xs text-muted">{t.hint}</p>
            </div>
            <Toggle on={Boolean(prefs[t.key])} onClick={() => toggle(t.key)} disabled={!isOwnerOrAdmin || saving} />
          </div>
        ))}
      </div>
      {!isOwnerOrAdmin && <p className="mt-3 text-xs text-faint">Solo el propietario o un administrador pueden cambiar estas preferencias.</p>}
    </SettingsCard>
  )
}
