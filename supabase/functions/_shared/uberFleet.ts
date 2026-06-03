// Núcleo de captura de flota de Uber (Vehicle Solutions), reutilizable SIN usuario.
// Lo usa el cron `schedule-capture` con service_role. Mismo flujo que la Edge Function
// `uber` pero recibiendo las credenciales ya resueltas (no depende de getUser()).

export type UberEnv = 'sandbox' | 'production'
export type UberCreds = { clientId: string; clientSecret: string; scope: string }

const envCfg = {
  tokenUrl: {
    sandbox: Deno.env.get('UBER_TOKEN_URL_SANDBOX') ?? 'https://sandbox-login.uber.com/oauth/v2/token',
    production: Deno.env.get('UBER_TOKEN_URL_PROD') ?? 'https://auth.uber.com/oauth/v2/token',
  },
  base: {
    sandbox: Deno.env.get('UBER_SANDBOX_BASE') ?? 'https://test-api.uber.com',
    production: Deno.env.get('UBER_PROD_BASE') ?? 'https://api.uber.com',
  },
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function mintToken(cacheKey: string, creds: UberCreds, envName: UberEnv) {
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.clientId, client_secret: creds.clientSecret })
  if (creds.scope) body.set('scope', creds.scope)
  const res = await fetch(envCfg.tokenUrl[envName] || envCfg.tokenUrl.sandbox, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Uber OAuth ${res.status}`)
  const ttlMs = data.expires_in ? data.expires_in * 1000 : 3_600_000
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })
  return data.access_token
}

async function rawCall(base: string, path: string, method: string, token: string, bodyText?: string) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(bodyText ? { 'Content-Type': 'application/json' } : {}) },
    body: bodyText || undefined,
  })
  const text = await r.text()
  let body: any
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text } }
  return { status: r.status, json: body }
}

function latestEntry(entries: any[]) {
  if (!Array.isArray(entries) || !entries.length) return null
  let best = entries[0]
  for (const e of entries) if ((e.timestamp || '') > (best.timestamp || '')) best = e
  return best
}

async function fetchDriverActions(base: string, token: string, orgEnc: string) {
  const out: any[] = []
  let pageToken = ''
  for (let i = 0; i < 25; i += 1) {
    const q = `?org_id=${orgEnc}&page_size=100${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''}`
    const res = await rawCall(base, `/v1/vehicle-suppliers/drivers/actions${q}`, 'GET', token)
    if (res.status !== 200) break
    const body = res.json?.body || res.json || {}
    for (const o of body.driverStatusOverviews || []) out.push(o)
    pageToken = body.paginationResult?.nextPageToken || ''
    if (!pageToken) break
  }
  return out
}

// Devuelve riders crudos de Uber para captura: { riderId, name, phone, status, statusSince }.
export async function captureUberFleet(orgId: string, creds: UberCreds, envName: UberEnv) {
  const base = envCfg.base[envName] || envCfg.base.sandbox
  const token = await mintToken(`${orgId}:${envName}:${creds.scope}`, creds, envName)

  const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
  if (orgsRes.status !== 200) throw new Error(`Uber orgs ${orgsRes.status}`)
  const orgs = orgsRes.json.organizations || []
  const parentIds = new Set(orgs.map((o: any) => o.parent_org_id).filter(Boolean))
  const targets = orgs.filter((o: any) => !parentIds.has(o.id))
  const useOrgs = targets.length ? targets : orgs

  const riders: any[] = []
  const seen = new Set<string>()
  for (const org of useOrgs) {
    const overviews = await fetchDriverActions(base, token, encodeURIComponent(org.id))
    for (const o of overviews) {
      const di = o.driverInfo || {}
      const id = di.driverUuid
      if (!id || seen.has(id)) continue
      seen.add(id)
      const entry = latestEntry(o.statusEntries)
      const status = entry?.status || null
      const onTrip = status === 'DRIVER_STATUS_ONTRIP'
      const online = status && status !== 'DRIVER_STATUS_OFFLINE' && status !== null
      riders.push({
        provider: 'uber',
        providerRiderId: id,
        name: `${di.firstName || ''} ${di.lastName || ''}`.trim(),
        phone: di.phone || null,
        email: di.email || null,
        status,
        online: Boolean(online),
        onTrip,
        lat: null,
        lng: null,
        activeDeliveries: onTrip ? 1 : 0,
        statusSince: entry?.timestamp ? Date.parse(entry.timestamp) : null,
      })
    }
  }
  return riders
}
