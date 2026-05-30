import { Zap } from 'lucide-react'
import MetaConfigBlock from './MetaConfigBlock'
import QuickTemplatesBlock from './QuickTemplatesBlock'
import SentMessagesPanel from './SentMessagesPanel'

export default function WhatsAppView() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <Zap className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>WhatsApp Business API (oficial).</strong> Una vez conectada en{' '}
          <strong>Ajustes → Integraciones</strong>, el envío masivo y por plantilla funciona{' '}
          <strong>de verdad en producción</strong> vía <span className="font-mono">Meta Cloud API</span>.
          Los botones de la tabla y el mapa abren <span className="font-mono">wa.me</span> (gratis, sin
          configuración).
        </p>
      </div>

      <MetaConfigBlock />
      <QuickTemplatesBlock />
      <SentMessagesPanel />
    </div>
  )
}
