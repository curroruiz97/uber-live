import { useCallback, useEffect, useRef, useState } from 'react'
import { QrCode, Loader2, Power, AlertTriangle, ShieldAlert } from 'lucide-react'
import CollapsibleCard from '../common/CollapsibleCard'
import { API_BASE, authHeaders } from '../../config/api'

const POLL_MS = 1500

async function waGet(path) {
  const r = await fetch(`${API_BASE}/api/wa${path}`, { headers: await authHeaders() })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
async function waPost(path) {
  const r = await fetch(`${API_BASE}/api/wa${path}`, { method: 'POST', headers: await authHeaders() })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

function prettyPhone(n) {
  if (!n) return ''
  const d = String(n).replace(/\D/g, '')
  // +CC + grupos de 3 (aproximado, solo presentación)
  return `+${d}`.replace(/(\+\d{2})(\d{3})(\d{3})(\d{0,3})/, '$1 $2 $3 $4').trim()
}

export default function QrConnectBlock() {
  const [st, setSt] = useState({ status: 'idle', qr: null, me: null, error: null })
  const [busy, setBusy] = useState(false)
  const [backendErr, setBackendErr] = useState(null)
  const pollRef = useRef(null)

  const stopPoll = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = null
  }, [])

  const startPoll = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const s = await waGet('/status')
        setSt(s)
        setBackendErr(null)
        if (s.status === 'ready' || s.status === 'error') stopPoll()
      } catch {
        setBackendErr('No se pudo contactar con el backend de WhatsApp.')
      }
    }, POLL_MS)
  }, [stopPoll])

  // Estado inicial: refleja una sesión ya conectada (sin lanzar Chromium).
  useEffect(() => {
    let alive = true
    waGet('/status')
      .then((s) => {
        if (!alive) return
        setSt(s)
        if (s.status === 'qr' || s.status === 'initializing' || s.status === 'authenticated') {
          startPoll()
        }
      })
      .catch(() => {})
    return () => {
      alive = false
      stopPoll()
    }
  }, [startPoll, stopPoll])

  async function connect() {
    setBusy(true)
    setBackendErr(null)
    try {
      const s = await waPost('/connect')
      setSt(s)
      startPoll()
    } catch {
      setBackendErr('No se pudo iniciar el backend de WhatsApp. ¿Está corriendo «npm run dev»?')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await waPost('/disconnect')
      stopPoll()
      setSt({ status: 'idle', qr: null, me: null, error: null })
    } catch {
      setBackendErr('No se pudo desconectar.')
    } finally {
      setBusy(false)
    }
  }

  const { status, qr, me, error } = st
  const connected = status === 'ready'
  const initializing = status === 'initializing' || (status === 'qr' && !qr) || busy
  const authenticating = status === 'authenticated'

  const right = connected ? (
    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400"> Conectado</span>
  ) : null

  return (
    <CollapsibleCard
      title="Bloque B · Conexión por QR (real)"
      subtitle="whatsapp-web.js · sesión real en el backend"
      icon={QrCode}
      right={right}
    >
      <div className="flex flex-col items-center justify-center gap-3">
        {connected ? (
          <div className="py-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <QrCode className="h-7 w-7" />
            </div>
            <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Conectado{me ? ` como ${prettyPhone(me)}` : ''}
            </p>
            <p className="text-xs text-faint">Sesión activa en el backend</p>
          </div>
        ) : qr ? (
          <>
            <div className="overflow-hidden rounded-lg bg-white p-2 ring-1 ring-line">
              <img src={qr} alt="Código QR de WhatsApp" className="h-44 w-44" />
            </div>
            <p className="text-sm text-muted">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p>
          </>
        ) : (
          <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-center">
            {initializing || authenticating ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-accent" />
                <p className="text-sm text-muted">
                  {authenticating ? 'Autenticando…' : 'Iniciando navegador…'}
                </p>
                <p className="text-[11px] text-faint">El primer arranque tarda unos segundos.</p>
              </>
            ) : (
              <>
                <QrCode className="h-7 w-7 text-faint" />
                <p className="px-4 text-xs text-faint">Pulsa «Conectar» para generar el QR real.</p>
              </>
            )}
          </div>
        )}
      </div>

      {(error || backendErr) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{backendErr || error}</span>
        </div>
      )}

      <div className="mt-4">
        {connected ? (
          <button
            onClick={disconnect}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:bg-inset hover:text-fg disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            Desconectar sesión
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={initializing || authenticating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {initializing || authenticating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            {qr ? 'Esperando escaneo…' : 'Conectar por QR'}
          </button>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-600 dark:text-amber-400">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Método <strong>no oficial</strong> (whatsapp-web.js). WhatsApp puede <strong>banear</strong>{' '}
          el número, sobre todo con envío masivo. Úsalo solo para pruebas. En producción usa la API
          oficial de Meta (Bloque A).
        </span>
      </div>
    </CollapsibleCard>
  )
}
