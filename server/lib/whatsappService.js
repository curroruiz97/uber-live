// =============================================================================
// Servicio WhatsApp (whatsapp-web.js) — lógica pura, sin Express ni Vite.
//
// Lanza un Chromium headless SOLO cuando se llama a connect() (import dinámico
// perezoso): arrancar el backend no abre nada ni se cae si falta la dependencia.
// La sesión se persiste en .wwebjs_auth/ (LocalAuth) -> reconexión sin re-escanear.
//
//  whatsapp-web.js es NO OFICIAL. WhatsApp puede BANEAR el número (sobre todo con
// envío masivo). Úsalo solo para pruebas / números de prueba.
// =============================================================================

// Estado compartido. Se guarda en globalThis para sobrevivir a recargas en dev
// (node --watch / HMR) y evitar lanzar dos Chromium o perder la sesión en memoria.
const wa =
  globalThis.__WA_STATE__ ||
  (globalThis.__WA_STATE__ = {
    client: null,
    initializing: false,
    status: 'idle', // idle | initializing | qr | authenticated | ready | disconnected | error
    qr: null, // data URL del QR real
    me: null, // número conectado
    error: null,
    updatedAt: Date.now(),
  })

function set(patch) {
  Object.assign(wa, patch, { updatedAt: Date.now() })
}

// Crea e inicializa el cliente una sola vez. Import dinámico: si falta la
// dependencia o Chromium, devolvemos un error legible en vez de tumbar el server.
export async function connect() {
  if (wa.client || wa.initializing) return getStatus()
  wa.initializing = true
  set({ status: 'initializing', qr: null, error: null })
  try {
    const mod = await import('whatsapp-web.js')
    const { Client, LocalAuth } = mod.default ?? mod
    const qrMod = await import('qrcode')
    const QR = qrMod.default ?? qrMod

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    })

    client.on('qr', async (qr) => {
      try {
        const dataUrl = await QR.toDataURL(qr, { margin: 1, width: 320 })
        set({ status: 'qr', qr: dataUrl, error: null })
      } catch {
        set({ status: 'qr', error: 'No se pudo renderizar el QR' })
      }
    })
    client.on('authenticated', () => set({ status: 'authenticated', qr: null }))
    client.on('ready', () =>
      set({
        status: 'ready',
        qr: null,
        me: client.info?.wid?.user || client.info?.me?.user || null,
      }),
    )
    client.on('auth_failure', (m) =>
      set({ status: 'error', error: String(m || 'Fallo de autenticación') }),
    )
    client.on('disconnected', (reason) => {
      set({ status: 'disconnected', qr: null, me: null, error: String(reason || '') })
      wa.client = null
    })

    wa.client = client
    client.initialize().catch((e) => {
      set({ status: 'error', error: e?.message || String(e) })
      wa.client = null
    })
  } catch (e) {
    set({
      status: 'error',
      error: `${e?.message || String(e)} — ¿instalaste whatsapp-web.js y se descargó Chromium? (npx puppeteer browsers install chrome)`,
    })
  } finally {
    wa.initializing = false
  }
  return getStatus()
}

export function getStatus() {
  return {
    status: wa.status,
    qr: wa.qr,
    me: wa.me,
    error: wa.error,
    ready: wa.status === 'ready',
    updatedAt: wa.updatedAt,
  }
}

export async function disconnect() {
  const c = wa.client
  wa.client = null
  set({ status: 'idle', qr: null, me: null, error: null })
  if (!c) return getStatus()
  try {
    await c.logout()
  } catch {
    /* puede fallar si la sesión no estaba lista */
  }
  try {
    await c.destroy()
  } catch {
    /* noop */
  }
  return getStatus()
}

export async function sendMessage(phone, message) {
  if (wa.status !== 'ready' || !wa.client) {
    const e = new Error('WhatsApp no está conectado (escanea el QR primero)')
    e.status = 409
    throw e
  }
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    const e = new Error('Teléfono inválido')
    e.status = 400
    throw e
  }
  const sent = await wa.client.sendMessage(`${digits}@c.us`, String(message ?? ''))
  return { id: sent?.id?._serialized || null, to: digits }
}
