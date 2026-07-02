import { useEffect, useState } from 'react'
import { Loader2, Save, CalendarClock } from 'lucide-react'
import { useSchedules } from '../../../state/schedules'
import { useOrg } from '../../../state/OrgContext'
import { useToast } from '../../../state/toast'
import SettingsField, { SettingsCard } from '../SettingsField'

const TIMEZONES = ['Europe/Madrid', 'Atlantic/Canary', 'UTC']

export default function SchedulesSection() {
  const { cfg, saveCfg } = useSchedules()
  const { isOwnerOrAdmin } = useOrg()
  const { toast } = useToast()
  const ro = !isOwnerOrAdmin

  const [tz, setTz] = useState(cfg.timezone || 'Europe/Madrid')
  const [minPct, setMinPct] = useState(String(cfg.min_compliance_pct ?? 100))
  const [presence, setPresence] = useState(String(cfg.presence_threshold_hours ?? 0.5))
  const [targetAccept, setTargetAccept] = useState(String(cfg.target_acceptance_pct ?? 90))
  const [maxCancel, setMaxCancel] = useState(String(cfg.max_cancel_pct ?? 5))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTz(cfg.timezone || 'Europe/Madrid')
    setMinPct(String(cfg.min_compliance_pct ?? 100))
    setPresence(String(cfg.presence_threshold_hours ?? 0.5))
    setTargetAccept(String(cfg.target_acceptance_pct ?? 90))
    setMaxCancel(String(cfg.max_cancel_pct ?? 5))
  }, [cfg])

  async function save() {
    setSaving(true)
    try {
      await saveCfg({
        timezone: tz,
        hours_metric: 'online',
        min_compliance_pct: Math.min(200, Math.max(0, Number(minPct) || 0)),
        presence_threshold_hours: Math.max(0, Number(presence) || 0),
        target_acceptance_pct: Math.min(100, Math.max(0, Number(targetAccept) || 0)),
        max_cancel_pct: Math.min(100, Math.max(0, Number(maxCancel) || 0)),
      })
      toast({ type: 'success', title: 'Configuración de cumplimiento guardada' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Define cómo se mide el cumplimiento: qué horas cuentan, el umbral para considerar un turno cumplido
        y los objetivos de calidad. Se aplica al cálculo diario, semanal y mensual.
      </p>

      <SettingsCard icon={CalendarClock} title="Cumplimiento de riders" subtitle="Reglas del cruce turnos × actividad real">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Zona horaria</label>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              disabled={ro}
              className="w-full rounded-lg border border-line bg-inset px-3 py-2.5 text-sm text-fg outline-none focus:border-accent/60 disabled:opacity-60"
            >
              {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <SettingsField label="Umbral de cumplimiento (%)" type="number" value={minPct} onChange={setMinPct} disabled={ro} hint="% de horas del turno para 'cumple' (100 = muy estricto)" />
          <SettingsField label="Horas mínimas de presencia" type="number" value={presence} onChange={setPresence} disabled={ro} hint="Por debajo se considera 'ausente'" />
          <SettingsField label="Objetivo de aceptación (%)" type="number" value={targetAccept} onChange={setTargetAccept} disabled={ro} hint="Avisa si la aceptación diaria baja de este valor" />
          <SettingsField label="Máx. cancelación (%)" type="number" value={maxCancel} onChange={setMaxCancel} disabled={ro} hint="Avisa si las cancelaciones superan este %" />
        </div>
        {!ro && (
          <div className="mt-4">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
