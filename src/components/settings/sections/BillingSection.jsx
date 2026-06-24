import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CreditCard, Users, Wallet, MessageSquareText, Check, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useFleet } from '../../../state/useFleetData'
import { usePlan } from '../../../state/PlanContext'
// SettingsCard ya no se usa — cabeceras inline homogéneas

const TIERS = [
  { id: 'starter', name: 'Starter', price: '49', riders: 'Hasta 50 riders', credits: '500 créditos/mes', features: ['Flota en vivo', 'Contacto WhatsApp (wa.me)', '1 integración', 'Hasta 3 usuarios'] },
  { id: 'growth', name: 'Growth', price: '149', riders: 'Hasta 200 riders', credits: '2.000 créditos/mes', features: ['Todo lo de Starter', 'SMS y Email certificado', 'Equipo ilimitado', 'Marca propia (logo y color)'], popular: true },
  { id: 'scale', name: 'Scale', price: '399', riders: 'Riders ilimitados', credits: '10.000 créditos/mes', features: ['Todo lo de Growth', 'Soporte prioritario', 'API y webhooks', 'SLA y onboarding'] },
]
const STATUS = {
  trialing: { label: 'Prueba', cls: 'border-accent/30 bg-accent/10 text-accent' },
  active: { label: 'Activo', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  past_due: { label: 'Pago pendiente', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  canceled: { label: 'Cancelado', cls: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' },
}

function Meter({ label, value, max, icon: Icon, unlimited }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="rounded-lg border border-line bg-inset/40 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span className="text-xs tabular-nums text-faint">{unlimited ? `${value} · ∞` : max != null ? `${value} / ${max}` : value}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value.toLocaleString('es-ES')}</p>
      {!unlimited && max != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
          <div className={clsx('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default function BillingSection() {
  const { riders } = useFleet()
  const plan = usePlan()
  const [msgs, setMsgs] = useState(0)

  useEffect(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const iso = start.toISOString()
    Promise.all([
      supabase.from('wa_sent_log').select('*', { count: 'exact', head: true }).gte('ts', iso),
      supabase.from('mensatek_sent_log').select('*', { count: 'exact', head: true }).gte('ts', iso),
    ]).then(([wa, mk]) => setMsgs((wa.count || 0) + (mk.count || 0)))
  }, [])

  const riderCount = riders?.length || 0
  const st = STATUS[plan.status] || STATUS.trialing

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <CreditCard className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">Plan actual</h3>
          </div>
          <p className="text-xs text-muted">Plan {plan.tier === 'trial' ? 'de prueba' : plan.tier} · uso de tu empresa.</p>
          <span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', st.cls)}>
            {st.label}{plan.isTrial && plan.daysLeftInTrial != null ? ` · ${plan.daysLeftInTrial}d` : ''}
          </span>
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Meter label="Riders gestionados" value={riderCount} max={plan.riderLimit} unlimited={plan.riderLimit == null} icon={Users} />
            <Meter label="Créditos del plan" value={plan.creditBalance} max={plan.includedCredits} icon={Wallet} />
            <Meter label="Mensajes este mes" value={msgs} icon={MessageSquareText} />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-muted">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>Cada SMS o email certificado consume 1 crédito por destinatario. El cobro y el cambio de plan con <strong className="text-fg">Stripe</strong> se activan en breve; tu uso ya se contabiliza.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-panel shadow-soft">
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-fg">Planes</h3>
          </div>
          <p className="text-xs text-muted">Elige según el tamaño de tu flota.</p>
        </div>
        <div className="border-t border-line px-4 py-4 sm:px-5 sm:py-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {TIERS.map((t) => {
              const current = plan.tier === t.id
              return (
                <div key={t.id} className={clsx('relative flex flex-col rounded-xl border p-4', current ? 'border-accent ring-2 ring-accent/30' : t.popular ? 'border-accent/40 bg-accent/5' : 'border-line bg-inset/30')}>
                  {current ? (
                    <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Tu plan</span>
                  ) : t.popular ? (
                    <span className="absolute -top-2 right-3 rounded-full bg-accent/80 px-2 py-0.5 text-[10px] font-semibold text-white">Popular</span>
                  ) : null}
                  <p className="text-sm font-semibold text-fg">{t.name}</p>
                  <p className="mt-1"><span className="text-2xl font-bold text-fg">{t.price}€</span><span className="text-xs text-muted">/mes</span></p>
                  <p className="mt-1 text-xs text-muted">{t.riders} · {t.credits}</p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> {f}</li>
                    ))}
                  </ul>
                  <button disabled className="mt-4 w-full cursor-not-allowed rounded-lg border border-line bg-inset py-2 text-xs font-semibold text-faint" title="Disponible con la integración de Stripe">
                    {current ? 'Plan actual' : 'Próximamente'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-center text-xs text-faint">Precios orientativos. El checkout se activa con Stripe; podrás cambiar de plan o cancelar cuando quieras.</p>
        </div>
      </section>
    </div>
  )
}
