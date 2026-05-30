import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Coins, KeyRound } from 'lucide-react'
import { useMensatek } from '../../state/mensatek'

function StatusPill({ status }) {
  const map = {
    ok: { cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: CheckCircle2, txt: 'Conectada' },
    checking: { cls: 'border-line bg-inset text-muted', icon: Loader2, txt: 'Verificando…' },
    error: { cls: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400', icon: XCircle, txt: 'Error' },
    auth: { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: AlertTriangle, txt: 'IP no autorizada' },
    not_configured: { cls: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: AlertTriangle, txt: 'Sin configurar' },
    idle: { cls: 'border-line bg-inset text-muted', icon: AlertTriangle, txt: 'Sin verificar' },
  }
  const s = map[status] ?? map.idle
  const Icon = s.icon
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', s.cls)}>
      <Icon className={clsx('h-3.5 w-3.5', status === 'checking' && 'animate-spin')} />
      {s.txt}
    </span>
  )
}

export default function MensatekConnectionBlock() {
  const { credits, conn, checkConnection } = useMensatek()
  const [busy, setBusy] = useState(false)

  // Verifica una sola vez al entrar (si no se ha comprobado ya), para no repetir el
  // 401 en bucle cada vez que se entra a la sección.
  useEffect(() => {
    if (conn.status === 'idle') checkConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verify() {
    setBusy(true)
    await checkConnection()
    setBusy(false)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Coins className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Conexión Mensatek</h3>
            <p className="text-xs text-muted">Estado del proxy y créditos disponibles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={busy ? 'checking' : conn.status} />
          <button
            onClick={verify}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-inset hover:text-fg disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', busy && 'animate-spin')} /> Verificar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
        <div className="bg-panel p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Créditos restantes</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fg">
            {credits == null ? '—' : credits.toLocaleString('es-ES', { maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-faint">Cada SMS/Email certificado consume créditos de tu cuenta Mensatek.</p>
        </div>
        <div className="bg-panel p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-faint">Autenticación</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-fg">
            <KeyRound className="h-4 w-4 text-faint" /> Basic Auth · API v7
          </p>
          <p className="mt-1 text-xs text-faint">
            El <span className="font-mono">API Token</span> vive en los secrets de la Edge Function, nunca en el navegador.
          </p>
        </div>
      </div>

      {conn.status === 'not_configured' && (
        <div className="border-t border-line bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">Aún no has configurado tus credenciales de Mensatek.</p>
          <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            Ve a <strong>Ajustes → Integraciones / APIs → Mensatek</strong>, introduce tu{' '}
            <strong>Usuario API</strong> y tu <strong>API Token</strong> (panel de Mensatek →{' '}
            <em>Tus Datos → Configurar Cuenta</em>) y pulsa <strong>Guardar</strong>.
          </p>
        </div>
      )}
      {conn.status === 'auth' && (
        <div className="border-t border-line bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">Mensatek rechaza la conexión desde el servidor.</p>
          <p className="mt-1 text-amber-700/80 dark:text-amber-300/80">
            Tus credenciales son correctas, pero Mensatek solo acepta llamadas desde IPs autorizadas
            y la del servidor no lo está. Entra en tu panel de Mensatek →{' '}
            <em>Tus Datos → Configurar Cuenta → API</em> y <strong>desactiva la restricción por IP</strong>{' '}
            (deja la lista en blanco) o pide a soporte@mensatek.com que permita IPs de servidor.
          </p>
        </div>
      )}
      {conn.status === 'error' && conn.message && (
        <div className="border-t border-line bg-red-500/5 p-4 text-xs text-red-600 dark:text-red-400">{conn.message}</div>
      )}
    </section>
  )
}
