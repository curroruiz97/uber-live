import { isNative, hasPlugin } from './platform'

// Push notifications nativas (APNs / FCM vía @capacitor/push-notifications).
//
// Estrategia de permiso: NO se pide al arrancar. La app llama a `enablePush()` en
// el momento adecuado (al entrar al panel por primera vez), y solo solicita el
// permiso si aún está en estado "prompt". Los handlers se inyectan desde React
// (toast en primer plano, navegación al tocar la notificación).
//
// El device token se guarda en Preferences y queda disponible para que el backend
// (Edge Function) lo asocie a la org/usuario. El registro server-side se documenta
// como siguiente paso en el README (no hay aún tabla device_tokens).

const TOKEN_KEY = 'ul-push-token'
const ASKED_KEY = 'ul-push-asked'

function available() {
  return isNative && hasPlugin('PushNotifications')
}

async function prefs() {
  const { Preferences } = await import('@capacitor/preferences')
  return Preferences
}

export async function getStoredPushToken() {
  if (!available()) return null
  try {
    const { value } = await (await prefs()).get({ key: TOKEN_KEY })
    return value || null
  } catch {
    return null
  }
}

// Registra los listeners y, si procede, solicita permiso y registra el device.
// `handlers`: { onToken, onForeground, onAction }. Devuelve una función de limpieza.
export async function enablePush(handlers = {}) {
  if (!available()) return () => {}

  let PushNotifications
  try {
    ;({ PushNotifications } = await import('@capacitor/push-notifications'))
  } catch {
    return () => {}
  }

  const subs = []
  try {
    subs.push(
      await PushNotifications.addListener('registration', async (token) => {
        try {
          await (await prefs()).set({ key: TOKEN_KEY, value: token.value })
        } catch {
          /* ignore */
        }
        handlers.onToken?.(token.value)
      }),
    )
    subs.push(
      await PushNotifications.addListener('registrationError', () => {
        /* silencioso: el usuario puede reintentar más tarde */
      }),
    )
    subs.push(
      await PushNotifications.addListener('pushNotificationReceived', (n) => {
        handlers.onForeground?.(n)
      }),
    )
    subs.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        handlers.onAction?.(a?.notification ?? null)
      }),
    )

    // Permiso: solo pedir si está sin determinar.
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
      try {
        await (await prefs()).set({ key: ASKED_KEY, value: '1' })
      } catch {
        /* ignore */
      }
    }
    if (perm.receive === 'granted') {
      await PushNotifications.register()
    }
  } catch {
    /* ignore: no romper la app por push */
  }

  return () => {
    for (const s of subs) {
      try {
        s?.remove?.()
      } catch {
        /* ignore */
      }
    }
  }
}
