# Sapiens Telco Live — App móvil (Capacitor)

Esta carpeta contiene la app móvil nativa de **Sapiens Telco Live** (gestión de flota
de riders en tiempo real). La app **reutiliza el SPA web** (React 18 + Vite) dentro de
un shell nativo con **Capacitor 6**, añadiendo navegación por pestañas, safe areas,
barra de estado por tema, botón atrás, pull-to-refresh, hojas inferiores, estado
offline, biometría, push y deep links.

## 1. Decisión de arquitectura (por qué Capacitor)

Se evaluaron tres rutas:

| Opción | Trade-off |
| --- | --- |
| **A) React Native / Expo** | Máximo rendimiento y APIs nativas, pero obliga a reescribir todo el SPA (mapa Leaflet, tablas, contextos) en JS desde cero. |
| **B) Capacitor + UI móvil dedicada** ✅ | Reutiliza el 100% del SPA Vite/React y del backend Supabase; se añade shell nativo (push, biometría, deep links, red) y patrones móviles (tab bar, sheets). Camino más corto a TestFlight / Play. |
| **C) Híbrido (web público + app nativa)** | Aporta poco aquí: **no hay superficie pública**; todo es panel autenticado. |

**Elegida: B (Capacitor).** El producto es un panel B2B denso (mapa + tablas + KPIs +
mensajería) ya construido y en producción como SPA; envolverlo y "nativizarlo" entrega
una app real sin duplicar la lógica de negocio ni romper RLS. Si en el futuro el mapa
necesita 60 fps con miles de markers, se puede sustituir solo esa vista por una capa de
mapa nativo (MapLibre/Mapbox) sin tocar el resto.

## 2. Qué se ha añadido sobre el SPA

- **Navegación nativa**: tab bar inferior por pantalla (`BottomTabBar`), con la pestaña
  *Mensajes* que agrupa WhatsApp + Mensatek mediante un segmented (`MessagesSegmented`).
- **Botón atrás de Android**: pila de manejadores (`src/native/backStack.js`) — cierra
  hojas/drawers/lock antes de navegar; en *Inicio* sale de la app.
- **Safe areas**: `viewport-fit=cover` + utilidades `pt-safe`/`pb-safe`/`pb-tabbar`.
- **Barra de estado** sincronizada con el tema claro/oscuro (`syncStatusBar`).
- **Pull-to-refresh** del snapshot de flota (`PullToRefresh`).
- **Filtros en hoja inferior** en móvil (`Filters` + `Sheet`).
- **Estado offline** (`NetworkContext` + `OfflineBanner`) usando `@capacitor/network`.
- **Biometría** (Face ID / huella) opcional para bloquear la app (`AppLock` +
  Ajustes → Seguridad), persistida con `@capacitor/preferences`.
- **Push notifications** (`src/native/push.js`): permiso pedido al entrar al panel,
  toast en primer plano y navegación al tocar (`data.route`).
- **Deep links de auth** (`src/native/deepLinks.js`): confirmación de email y OAuth
  vuelven a la app por el esquema `com.sapiens.telcolive://auth-callback`.
- **Háptica** en cambios de pestaña y gestos (`@capacitor/haptics`).

Todo degrada a un no-op limpio en web (la SPA sigue funcionando igual en el navegador).

## 3. Requisitos

- Node 22, npm.
- **Android**: Android Studio (SDK 34+, JDK 17).
- **iOS**: macOS con Xcode 15+ y CocoaPods (`sudo gem install cocoapods`).

## 4. Variables de entorno

La app usa las mismas variables `VITE_*` del SPA (ver `.env.example`). En el bundle
móvil se **incrustan en build**, así que apunta a la **URL pública** del proyecto
Supabase (no `localhost`):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
# Opcional, solo si el backend Express vive en otro origen:
VITE_API_BASE=https://api.tudominio.com
```

> Las claves sensibles (service_role, secretos de Uber/WhatsApp/Mensatek/Stripe) **no**
> van en el cliente: viven en las Edge Functions de Supabase. Nunca las incrustes.

## 5. Build y ejecución

```bash
npm install
npm run build          # compila el SPA a dist/
npx cap sync           # copia dist/ + plugins a android/ e ios/

# Android
npm run cap:android    # build + sync + abre Android Studio
#   o:  npx cap run android   (dispositivo/emulador conectado)

# iOS (en macOS)
cd ios/App && pod install && cd -
npm run cap:ios        # build + sync + abre Xcode
```

Scripts útiles (en `package.json`):

- `npm run cap:sync` — `build` + `cap sync`.
- `npm run cap:android` / `npm run cap:ios` — build, sync y abrir el IDE nativo.
- `npm run cap:run:android` / `:ios` — build y lanzar en dispositivo/emulador.
- `npm test` — suite de Vitest (lógica de filtros y utilidades de tiempo).

## 6. Configuración nativa ya incluida

- **App id / nombre**: `com.sapiens.telcolive` / "Sapiens Telco Live"
  (`capacitor.config.json`).
- **Android** (`android/app/src/main/AndroidManifest.xml`): intent-filter del deep link
  `com.sapiens.telcolive://auth-callback`; permisos `ACCESS_NETWORK_STATE`,
  `USE_BIOMETRIC`, `POST_NOTIFICATIONS`.
- **iOS** (`ios/App/App/Info.plist`): `CFBundleURLSchemes` con el esquema de la app y
  `NSFaceIDUsageDescription`.

## 7. Pasos pendientes antes de publicar

1. **Supabase → Auth → URL Configuration**: añade `com.sapiens.telcolive://auth-callback`
   a *Redirect URLs* (para confirmación de email y OAuth Google/LinkedIn).
2. **Push notifications**:
   - Android: crea el proyecto Firebase y coloca `google-services.json` en
     `android/app/` (está en el `.gitignore`); añade el plugin Google Services en Gradle.
   - iOS: activa *Push Notifications* y *Background Modes → Remote notifications* en
     Xcode; sube la clave APNs a Supabase / tu proveedor.
   - Backend: persiste el device token (expuesto por `getStoredPushToken()`) en una
     tabla `device_tokens(org_id, user_id, token, platform)` con RLS y dispárale push
     desde una Edge Function en los eventos (nueva incidencia, cambio de estado, mensaje).
3. **OAuth (Google / LinkedIn)**: ya está cableado (`signInWithOAuth`); falta añadir los
   botones a la pantalla de login y configurar los proveedores en Supabase.
4. **Iconos y splash**: genera los assets con `@capacitor/assets`
   (`npx @capacitor/assets generate`) a partir del logo de marca.
5. **Distribución**:
   - Android: `./gradlew bundleRelease` (firma con tu keystore) → **Play Internal testing**.
   - iOS: *Archive* en Xcode → **TestFlight**.

## 8. Estructura del puente nativo (`src/native/`)

```
platform.js      isNative / platform / hasPlugin
index.js         initNativeShell() (splash, teclado, atrás, deep links) + syncStatusBar()
NativeBridge.jsx componente que inicializa el shell y sincroniza la barra de estado
backStack.js     pila de manejadores del botón atrás
deepLinks.js     redirect de auth + handleAuthDeepLink()
haptics.js       impactLight / impactMedium / selection
biometric.js     disponibilidad, verificación y preferencia de bloqueo
push.js          enablePush() — permiso + listeners + token
useNativeBack.js hook: atrás → vuelve a Inicio
useNativePush.js hook: push → toast + navegación
```
