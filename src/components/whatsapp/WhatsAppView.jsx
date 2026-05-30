import { Zap } from 'lucide-react'
import MetaConfigBlock from './MetaConfigBlock'
import QrConnectBlock from './QrConnectBlock'
import QuickTemplatesBlock from './QuickTemplatesBlock'
import SentMessagesPanel from './SentMessagesPanel'

export default function WhatsAppView() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
        <Zap className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>WhatsApp Business API (oficial).</strong> El <strong>Bloque A</strong> usa la{' '}
          <span className="font-mono">Meta Cloud API</span>: una vez conectada en{' '}
          <strong>Ajustes → Integraciones</strong>, el envío masivo y por plantilla funciona{' '}
          <strong>de verdad en producción</strong>. Los botones de la tabla y el mapa abren{' '}
          <span className="font-mono">wa.me</span> (gratis, sin configuración). El{' '}
          <strong>Bloque B</strong> (QR) es opcional y requiere servidor propio.
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <MetaConfigBlock />
        <QrConnectBlock />
      </div>

      <QuickTemplatesBlock />
      <SentMessagesPanel />
    </div>
  )
}
