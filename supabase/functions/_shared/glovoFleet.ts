// Núcleo de captura de flota de Glovo (Live Operations API), reutilizable SIN usuario.
// Lo usa el cron `schedule-capture` con service_role. Firma JWT RS256 -> STS -> Bearer
// -> Live Ops. Mismo flujo que la Edge Function `glovo` pero recibiendo credenciales.

export type GlovoEnv = 'staging' | 'production'
export type GlovoCreds = {
  clientId: string
  kid: string
  privateKey: string
  companyId: string
  cityCodes: string
  liveScope: string
}

const envCfg = {
  stsAud: Deno.env.get('GLOVO_STS_AUD') ?? 'https://sts.deliveryhero.io',
  sts: {
    staging: Deno.env.get('GLOVO_STS_STAGING') ?? 'https://sts-st.dh-auth.io/oauth2/token',
    production: Deno.env.get('GLOVO_STS_PROD') ?? 'https://sts.dh-auth.io/oauth2/token',
  },
  live: {
    staging: Deno.env.get('GLOVO_LIVE_STAGING') ?? 'https://gv-pl-st.usehurrier.com',
    production: Deno.env.get('GLOVO_LIVE_PROD') ?? 'https://gv-es.usehurrier.com',
  },
}

function b64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array
  if (typeof input === 'string') bytes = new TextEncoder().encode(input)
  else bytes = new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

async function buildClientAssertion(creds: GlovoCreds): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: creds.kid }
  const payload = { aud: envCfg.stsAud, iss: creds.clientId, sub: creds.clientId, jti: crypto.randomUUID(), iat: now, exp: now + 60 }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(creds.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  return `${signingInput}.${b64url(sig)}`
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function mintToken(orgId: string, creds: GlovoCreds, envName: GlovoEnv) {
  const cacheKey = `${orgId}:${envName}:${creds.liveScope}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const assertion = await buildClientAssertion(creds)
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  })
  if (creds.liveScope) body.set('scope', creds.liveScope)
  const res = await fetch(envCfg.sts[envName] || envCfg.sts.staging, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Glovo STS ${res.status}`)
  const ttlMs = data.expires_in ? data.expires_in * 1000 : 7_200_000
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })
  return data.access_token
}

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

function mapLiveRider(r: any, city: { code: string; cityId: string }) {
  const loc = r.location || r.last_location || {}
  const lat = loc.lat ?? loc.latitude
  const lng = loc.lng ?? loc.lon ?? loc.longitude
  const status = r.status || r.state || null
  const st = String(status || '').toLowerCase()
  const online = st !== '' && st !== 'offline' && st !== 'break' && st !== 'ending'
  const deliveries = r.deliveries ?? r.total_deliveries ?? 0
  return {
    provider: 'glovo',
    providerRiderId: String(r.id ?? r.courier_id ?? r.rider_id ?? ''),
    name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.name || '',
    phone: r.phone_number || r.phone || null,
    email: null,
    status,
    online,
    onTrip: Number(deliveries) > 0,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    activeDeliveries: Number(deliveries) || 0,
    statusSince: r.status_since ? Date.parse(r.status_since) : null,
  }
}

// Devuelve riders crudos de Glovo para captura. Escalonado por rate limits.
export async function captureGlovoFleet(orgId: string, creds: GlovoCreds, envName: GlovoEnv) {
  const base = envCfg.live[envName] || envCfg.live.staging
  const token = await mintToken(orgId, creds, envName)
  const cities = parseCities(creds.cityCodes)
  const company = encodeURIComponent(creds.companyId)
  const riders: any[] = []

  for (const city of cities) {
    for (let page = 0; page < 50; page += 1) {
      const path =
        `/api/rider-live-operations/v2/external/city/${encodeURIComponent(city.cityId)}/riders` +
        `?filter_companies=${company}&page=${page}&size=50`
      const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (r.status === 429) break
      if (r.status !== 200) break
      const body = await r.json().catch(() => ({}))
      const list = body.content || body.riders || body.data || []
      for (const item of list) {
        const rider = mapLiveRider(item, city)
        if (rider.providerRiderId) riders.push(rider)
      }
      const last = body.last ?? (list.length < 50)
      if (last) break
      await new Promise((res) => setTimeout(res, 250))
    }
  }
  return riders
}
