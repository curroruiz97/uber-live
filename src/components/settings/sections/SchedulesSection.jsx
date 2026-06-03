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
  const [graceIn, setGraceIn] = useState(String(cfg.grace_in_min ?? 5))
  const [graceOut, setGraceOut] = useState(String(cfg.grace_out_min ?? 5))
  const [minPct, setMinPct] = useState(String(cfg.min_compliance_pct ?? 90))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTz(cfg.timezone || 'Europe/Madrid')
    setGraceIn(String(cfg.grace_in_min ?? 5))
    setGraceOut(String(cfg.grace_out_min ?? 5))
    setMinPct(String(cfg.min_compliance_pct ?? 90))
  }, [cfg])

  async function save() {
    setSaving(true)
    try {
      await saveCfg({
        timezone: tz,
        grace_in_min: Math.max(0, Number(graceIn) || 0),
        grace_out_min: Math.max(0, Number(graceOut) || 0),
        min_compliance_pct: Math.min(100, Math.max(0, Number(minPct) || 0)),
      })
      toast({ type: 'success', title: 'Configuración de horarios guardada' })
    } catch (e) {
      toast({ type: 'error', title: 'No se pudo guardar', message: e.message })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Define cómo se mide el cumplimiento de horarios de tus riders: zona horaria, márgenes de
        cortesía y umbral mínimo de cumplimiento.
      </p>

      <SettingsCard icon={CalendarClock} title="Cumplimiento de horarios" subtitle="Reglas que aplica el cálculo diario, semanal y mensual">
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
          <SettingsField label="Umbral mínimo de cumplimiento (%)" type="number" value={minPct} onChange={setMinPct} disabled={ro} hint="Por debajo se marca como incompleto" />
          <SettingsField label="Margen de cortesía entrada (min)" type="number" value={graceIn} onChange={setGraceIn} disabled={ro} hint="Minutos de retraso que se toleran sin marcar 'tarde'" />
          <SettingsField label="Margen de cortesía salida (min)" type="number" value={graceOut} onChange={setGraceOut} disabled={ro} hint="Minutos antes del fin que se toleran" />
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
