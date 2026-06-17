// Edge Function (Deno): proxy de Glovo Live Operations API — MULTI-TENANT.
// Resuelve la organización del llamante (header x-org-id, validado contra org_members)
// y carga sus credenciales de Glovo desde org_integrations/org_secrets (service_role),
// con fallback a los secrets de entorno. La clave privada RSA nunca llega al navegador.
//
// Auth de Glovo/DeliveryHero (distinta a Uber):
//   1. Se firma un client_assertion JWT (RS256) con la clave privada RSA del 3PL.
//   2. Se intercambia en STS (sts.dh-auth.io) por un access_token Bearer (~2h).
//   3. Se llama a la Live Operations API (gv-es.usehurrier.com) con ese Bearer.
// Reglas: un scope por token; segregación estricta por company id; cachear el token.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Config GLOBAL: endpoints por entorno + fallback de credenciales.
const envCfg = {
  clientId: Deno.env.get('GLOVO_CLIENT_ID') ?? '',
  kid: Deno.env.get('GLOVO_KID') ?? '',
  privateKey: Deno.env.get('GLOVO_PRIVATE_KEY') ?? '',
  companyId: Deno.env.get('GLOVO_COMPANY_ID') ?? '',
  cityCodes: Deno.env.get('GLOVO_CITY_CODES') ?? '',
  // El aud del JWT es fijo; el POST del intercambio va a sts.dh-auth.io (no a deliveryhero.io).
  stsAud: Deno.env.get('GLOVO_STS_AUD') ?? 'https://sts.deliveryhero.io',
  sts: {
    staging: Deno.env.get('GLOVO_STS_STAGING') ?? 'https://sts-st.dh-auth.io/oauth2/token',
    production: Deno.env.get('GLOVO_STS_PROD') ?? 'https://sts.dh-auth.io/oauth2/token',
  },
  // Live Operations API (Rider Live Ops). Host por entorno.
  live: {
    staging: Deno.env.get('GLOVO_LIVE_STAGING') ?? 'https://gv-pl-st.usehurrier.com',
    production: Deno.env.get('GLOVO_LIVE_PROD') ?? 'https://gv-es.usehurrier.com',
  },
  // Scope del Live Ops. Glovo lo concede por 3PL; se puede sobreescribir por secret.
  liveScope: Deno.env.get('GLOVO_LIVE_SCOPE') ?? '',
}

type EnvName = 'staging' | 'production'
type Creds = {
  clientId: string
  kid: string
  privateKey: string
  companyId: string
  cityCodes: string
  liveScope: string
}

// ---- Utilidades JWT / RSA (SubtleCrypto, sin dependencias) ----
function b64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') bytes = new TextEncoder().encode(input)
  else bytes = new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// PEM PKCS8 -> CryptoKey RSA para firmar (RS256).
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function uuid(): string {
  return crypto.randomUUID()
}

// Construye y firma el client_assertion JWT (RS256) con la clave privada del 3PL.
async function buildClientAssertion(creds: Creds): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: creds.kid }
  const payload = {
    aud: envCfg.stsAud,
    iss: creds.clientId,
    sub: creds.clientId,
    jti: uuid(),
    iat: now,
    exp: now + 60, // 60s: dentro de la ventana exigida (<5 min).
  }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await importPrivateKey(creds.privateKey)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${b64url(sig)}`
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

// Mintea (o reusa) el access_token Bearer de STS. Cachea ~2h por org+entorno+scope.
async function mintToken(orgId: string, creds: Creds, envName: EnvName, force?: boolean): Promise<string> {
  const cacheKey = `${orgId}:${envName}:${creds.liveScope}`
  if (!force) {
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  }
  const assertion = await buildClientAssertion(creds)
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })
  // courier-3pl exige exactamente un scope por token; si está configurado, lo enviamos.
  if (creds.liveScope) body.set('scope', creds.liveScope)

  const res = await fetch(envCfg.sts[envName] || envCfg.sts.staging, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const err: any = new Error(`STS ${res.status}: ${data.error_description || data.error || JSON.stringify(data)}`)
    err.status = 401
    err.kind = 'auth'
    throw err
  }
  const ttlMs = data.expires_in ? data.expires_in * 1000 : 7_200_000
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })
  return data.access_token
}

async function rawCall(base: string, path: string, token: string) {
  const r = await fetch(base + path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const text = await r.text()
  let body: any
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  return { status: r.status, json: body }
}

// "BCN:12,MAD:7" -> [{code:'BCN',cityId:'12'}]; "12,7" -> [{code:'12',cityId:'12'}]
function parseCities(cityCodes: string): { code: string; cityId: string }[] {
  return String(cityCodes || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [a, b] = part.split(':').map((x) => x.trim())
      return b ? { code: a, cityId: b } : { code: a, cityId: a }
    })
}

// Aplana la respuesta de Live Ops a riders {id,status,lat,lng,name,...}.
function mapLiveRider(r: any, city: { code: string; cityId: string }) {
  const loc = r.location || r.last_location || {}
  const lat = loc.lat ?? loc.latitude
  const lng = loc.lng ?? loc.lon ?? loc.longitude
  return {
    id: r.id ?? r.courier_id ?? r.rider_id,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.name || '',
    phone: r.phone_number || r.phone || null,
    status: r.status || r.state || null,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    vehicle: r.vehicle_type || r.vehicle || null,
    city: city.code,
    cityId: city.cityId,
    deliveries: r.deliveries ?? r.total_deliveries ?? 0,
    statusSince: r.status_since ? Date.parse(r.status_since) : null,
  }
}

async function fetchLive(orgId: string, creds: Creds, envName: EnvName, onlyPing = false) {
  const base = envCfg.live[envName] || envCfg.live.staging
  const token = await mintToken(orgId, creds, envName)
  const cities = parseCities(creds.cityCodes)
  if (!cities.length) {
    const err: any = new Error('No hay ciudades configuradas para Glovo (city codes).')
    err.status = 400
    err.kind = 'config'
    throw err
  }
  const company = encodeURIComponent(creds.companyId)
  const riders: any[] = []
  let working = 0

  for (const city of cities) {
    // Paginado de Live Ops; escalonado para respetar rate limits (GET 60/10s).
    for (let page = 0; page < 50; page += 1) {
      const path =
        `/api/rider-live-operations/v2/external/city/${encodeURIComponent(city.cityId)}/riders` +
        `?filter_companies=${company}&page=${page}&size=50`
      const res = await rawCall(base, path, token)
      if (res.status === 401 || res.status === 403) {
        const err: any = new Error('Glovo rechazó el token (scope/company no autorizado).')
        err.status = 401
        err.kind = 'auth'
        throw err
      }
      if (res.status === 429) break // rate limited: corta y devolvemos lo que haya.
      if (res.status !== 200) break
      const body = res.json || {}
      const list = body.content || body.riders || body.data || []
      for (const r of list) {
        const rider = mapLiveRider(r, city)
        if (!rider.id) continue
        riders.push(rider)
        const st = String(rider.status || '').toLowerCase()
        if (st && st !== 'offline' && st !== 'break' && st !== 'ending') working += 1
      }
      if (onlyPing) return { ok: true, riders, count: riders.length }
      const last = body.last ?? (list.length < 50)
      if (last) break
      // Pequeña pausa entre páginas para no disparar el rate limit.
      await new Promise((r) => setTimeout(r, 250))
    }
  }

  return {
    riders,
    metrics: { ordersInProgress: working, completedToday: 0, avgMinutes: 0, openIncidents: 0 },
  }
}

// Resuelve la org del llamante y carga sus credenciales (con fallback a env).
async function resolveOrgCreds(userClient: any, adminClient: any, requestedOrgId: string) {
  let orgId = requestedOrgId
  if (orgId) {
    // limit(1): por RLS un miembro ve TODAS las filas de su org; sin limit, maybeSingle
    // falla con varias y daría un falso "No perteneces" en orgs con >1 miembro.
    const { data } = await userClient.from('org_members').select('org_id').eq('org_id', orgId).limit(1).maybeSingle()
    if (!data) {
      const err: any = new Error('No perteneces a esta organización.')
      err.status = 403
      err.kind = 'forbidden'
      throw err
    }
  } else {
    const { data } = await userClient.from('org_members').select('org_id').order('created_at', { ascending: true }).limit(1).maybeSingle()
    orgId = data?.org_id || ''
  }

  let integ: any = null
  let secrets: any = null
  if (orgId) {
    const [{ data: i }, { data: s }] = await Promise.all([
      adminClient
        .from('org_integrations')
        .select('glovo_client_id, glovo_kid, glovo_company_id, glovo_city_codes, glovo_environment')
        .eq('org_id', orgId)
        .maybeSingle(),
      adminClient.from('org_secrets').select('glovo_private_key').eq('org_id', orgId).maybeSingle(),
    ])
    integ = i
    secrets = s
  }
  const creds: Creds = {
    clientId: integ?.glovo_client_id || envCfg.clientId,
    kid: integ?.glovo_kid || envCfg.kid,
    privateKey: secrets?.glovo_private_key || envCfg.privateKey,
    companyId: integ?.glovo_company_id || envCfg.companyId,
    cityCodes: integ?.glovo_city_codes || envCfg.cityCodes,
    liveScope: envCfg.liveScope,
  }
  const environment: EnvName = integ?.glovo_environment === 'production' ? 'production' : 'staging'
  return { orgId, creds, environment }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/glovo/, '') || '/'
  const requestedOrgId = req.headers.get('x-org-id') || url.searchParams.get('org_id') || ''
  // El entorno efectivo lo manda la config de la org; el query ?env es solo informativo.

  try {
    const { orgId, creds, environment } = await resolveOrgCreds(userClient, adminClient, requestedOrgId)
    const configured = Boolean(creds.clientId && creds.privateKey && creds.companyId && creds.cityCodes)

    if (path === '/health' || path === '/') {
      return json(200, {
        orgId,
        environment,
        configured,
        hasClientId: Boolean(creds.clientId),
        hasKey: Boolean(creds.privateKey),
        hasCompany: Boolean(creds.companyId),
        hasCities: Boolean(creds.cityCodes),
      })
    }

    if (!configured) {
      return json(503, {
        error: 'not_configured',
        message: 'Esta organización no tiene configuradas las credenciales de Glovo (client_id, clave RSA, company id y ciudades).',
      })
    }

    if (path === '/ping') {
      const r = await fetchLive(orgId, creds, environment, true)
      return json(200, { ok: true, riders: r.count })
    }
    if (path === '/fleet') {
      const fleet = await fetchLive(orgId, creds, environment, false)
      const { data: sub } = await adminClient.from('subscriptions').select('rider_limit').eq('org_id', orgId).maybeSingle()
      const riderLimit = sub?.rider_limit ?? null
      return json(200, { ...fleet, riderLimit, overLimit: riderLimit != null && (fleet.riders?.length || 0) > riderLimit })
    }
    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message })
  }
})
