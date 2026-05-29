import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CreditCard, Users, MessageSquareText, Check, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useFleet } from '../../../state/useFleetData'
import { SettingsCard } from '../SettingsField'

const TIERS = [
  { id: 'starter', name: 'Starter', price: '49', riders: 'Hasta 50 riders', credits: '500 créditos/mes', features: ['Flota en vivo', 'Contacto WhatsApp (wa.me)', '1 integración', 'Hasta 3 usuarios'] },
  { id: 'growth', name: 'Growth', price: '149', riders: 'Hasta 200 riders', credits: '2.000 créditos/mes', features: ['Todo lo de Starter', 'SMS y Email certificado', 'Equipo ilimitado', 'Marca propia (logo y color)'], popular: true },
  { id: 'scale', name: 'Scale', price: '399', riders: 'Riders ilimitados', credits: '10.000 créditos/mes', features: ['Todo lo de Growth', 'Soporte prioritario', 'API y webhooks', 'SLA y onboarding'] },
]

function Meter({ label, value, max, icon: Icon, suffix }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="rounded-lg border border-line bg-inset/40 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted"><Icon className="h-3.5 w-3.5" /> {label}</span>
        <span className="text-xs tabular-nums text-faint">{max ? `${value} / ${max}` : value}{suffix}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}{suffix}</p>
      {max ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset">
          <div className={clsx('h-full rounded-full transition-all', pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

export default function BillingSection() {
  const { riders } = useFleet()
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

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={CreditCard}
        title="Plan actual"
        subtitle="Uso de tu empresa este mes"
        right={<span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">Prueba · 14 días</span>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Meter label="Riders gestionados" value={riderCount} max={50} icon={Users} />
          <Meter label="Mensajes enviados (este mes)" value={msgs} icon={MessageSquareText} />
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs text-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>Estás en el periodo de prueba. El cobro con <strong className="text-fg">Stripe</strong> (cambio de plan, método de pago y facturas) se activa en la siguiente fase. Tu uso ya se contabiliza aquí.</p>
        </div>
      </SettingsCard>

      <SettingsCard icon={Sparkles} title="Planes" subtitle="Elige según el tamaño de tu flota">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.id} className={clsx('relative flex flex-col rounded-xl border p-4', t.popular ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/20' : 'border-line bg-inset/30')}>
              {t.popular && <span className="absolute -top-2 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">Popular</span>}
              <p className="text-sm font-semibold text-fg">{t.name}</p>
              <p className="mt-1"><span className="text-2xl font-bold text-fg">{t.price}€</span><span className="text-xs text-muted">/mes</span></p>
              <p className="mt-1 text-xs text-muted">{t.riders} · {t.credits}</p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> {f}</li>
                ))}
              </ul>
              <button disabled className="mt-4 w-full cursor-not-allowed rounded-lg border border-line bg-inset py-2 text-xs font-semibold text-faint" title="Disponible con la integración de Stripe">
                Próximamente
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-faint">Precios orientativos. Podrás cambiar de plan o cancelar cuando quieras desde el portal de cliente.</p>
      </SettingsCard>
    </div>
  )
}
