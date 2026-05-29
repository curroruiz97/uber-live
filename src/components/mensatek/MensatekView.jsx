import { BadgeCheck } from 'lucide-react'
import MensatekConnectionBlock from './MensatekConnectionBlock'
import MensatekIssuerBlock from './MensatekIssuerBlock'
import MensatekSendPanel from './MensatekSendPanel'
import MensatekTemplatesBlock from './MensatekTemplatesBlock'
import MensatekSentPanel from './MensatekSentPanel'

export default function MensatekView() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm text-fg">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="text-muted">
          <strong className="text-fg">Comunicaciones certificadas.</strong> Envía{' '}
          <strong>SMS Certificado</strong>, <strong>SMS Contrato</strong> y{' '}
          <strong>Email Certificado</strong> a los riders usando su teléfono y su email. Cada envío
          genera un <strong>certificado PDF con sellado de tiempo</strong> y valor legal vía Mensatek.
          El envío es <strong>real</strong>: requiere créditos y las credenciales de tu cuenta.
        </p>
      </div>

      <MensatekConnectionBlock />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.4fr_1fr]">
        <MensatekSendPanel />
        <div className="space-y-4">
          <MensatekIssuerBlock />
          <MensatekTemplatesBlock />
        </div>
      </div>

      <MensatekSentPanel />
    </div>
  )
}
