import { createUberClient } from './uberClient'

// Valida la conexión real a través del proxy local antes de entrar al dashboard.
// 1) comprueba que el proxy está vivo y configurado (/health)
// 2) hace una llamada de prueba a deliveries
// Devuelve un resultado uniforme (no lanza) para mostrar el error con contexto.
export async function validateConnection({ environment, token }, signal) {
  const client = createUberClient({ environment, token })

  let health
  try {
    health = await client.getHealth(signal)
  } catch (e) {
    return { ok: false, kind: e?.kind || 'network', message: e?.message || 'No se pudo contactar con el proxy.' }
  }

  if (!token && !health.configured) {
    return {
      ok: false,
      kind: 'not_configured',
      message:
        'El proxy está activo pero faltan credenciales. Añade UBER_CLIENT_SECRET (y el scope) en el archivo .env y reinicia npm run dev.',
    }
  }

  try {
    // Validación ligera: solo comprueba auth + orgs (no descarga la flota completa,
    // que puede tardar ~10s y duplicar la carga contra Uber). La flota la trae el dashboard.
    const ping = await client.getPing(signal)
    return { ok: true, ping }
  } catch (e) {
    return { ok: false, kind: e?.kind || 'unknown', message: e?.message || 'Error al llamar a la API de Uber.' }
  }
}
