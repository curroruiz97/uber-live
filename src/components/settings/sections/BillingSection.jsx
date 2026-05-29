import { CreditCard, Sparkles, Users, MessageSquareText } from 'lucide-react'
import { SettingsCard } from '../SettingsField'

// Placeholder de facturación. La integración real con Stripe (planes por flota +
// créditos de mensajería, checkout, portal y webhooks) llega en la siguiente fase.
export default function BillingSection() {
  return (
    <div className="space-y-4">
      <SettingsCard
        icon={CreditCard}
        title="Plan actual"
        subtitle="Suscripción y facturación de tu empresa"
        right={<span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">Prueba</span>}
      >
        <div className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-muted">
            La facturación con <strong className="text-fg">Stripe</strong> se activa en la próxima fase: podrás
            elegir plan, gestionar el método de pago y las facturas, y comprar créditos de mensajería.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-inset/40 p-4">
            <Users className="h-4 w-4 text-accent" />
            <p className="mt-2 text-sm font-semibold text-fg">Por tamaño de flota</p>
            <p className="text-xs text-muted">El plan base escala según el número de riders que gestionas.</p>
          </div>
          <div className="rounded-lg border border-line bg-inset/40 p-4">
            <MessageSquareText className="h-4 w-4 text-accent" />
            <p className="mt-2 text-sm font-semibold text-fg">Créditos de mensajería</p>
            <p className="text-xs text-muted">Bolsa de créditos para SMS, email y WhatsApp, con recargas.</p>
          </div>
          <div className="rounded-lg border border-line bg-inset/40 p-4">
            <CreditCard className="h-4 w-4 text-accent" />
            <p className="mt-2 text-sm font-semibold text-fg">Autoservicio</p>
            <p className="text-xs text-muted">Cambia de plan o método de pago cuando quieras desde el portal.</p>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}
