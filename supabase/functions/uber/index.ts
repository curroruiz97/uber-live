// Edge Function (Deno): proxy de Uber Vehicle Solutions.
// Sustituye al backend Express en producción (todo serverless: Vercel + Supabase).
// Guarda el client_secret en los secrets de la función (UBER_CLIENT_SECRET, etc.),
// hace OAuth (client_credentials), cachea el token y fusiona orgs -> drivers/actions
// (estado) + analytics (métricas hoy) en { orgs, riders[], metrics }.
//
// Seguridad: exige un USUARIO real de Supabase (getUser); la anon key sola no basta.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-uber-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const cfg = {
  clientId: Deno.env.get('UBER_CLIENT_ID') ?? '',
  clientSecret: Deno.env.get('UBER_CLIENT_SECRET') ?? '',
  scope: Deno.env.get('UBER_SCOPE') ?? '',
  tokenUrl: {
    sandbox: Deno.env.get('UBER_TOKEN_URL_SANDBOX') ?? 'https://sandbox-login.uber.com/oauth/v2/token',
    production: Deno.env.get('UBER_TOKEN_URL_PROD') ?? 'https://auth.uber.com/oauth/v2/token',
  },
  base: {
    sandbox: Deno.env.get('UBER_SANDBOX_BASE') ?? 'https://test-api.uber.com',
    production: Deno.env.get('UBER_PROD_BASE') ?? 'https://api.uber.com',
  },
}

type EnvName = 'sandbox' | 'production'
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function mintToken(envName: EnvName, scopeOverride?: string | null, force?: boolean) {
  const scope = scopeOverride != null ? scopeOverride : cfg.scope
  const cacheKey = `${envName}:${scope}`
  if (!force) {
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (scope) body.set('scope', scope)
  const res = await fetch(cfg.tokenUrl[envName] || cfg.tokenUrl.sandbox, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const err: any = new Error(`OAuth ${res.status}: ${data.error_description || data.error || JSON.stringify(data)}`)
    err.status = 401
    err.kind = 'oauth'
    throw err
  }
  const ttlMs = data.expires_in ? data.expires_in * 1000 : 3_600_000
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })
  return data.access_token
}

async function rawCall(base: string, path: string, method: string, token: string, bodyText?: string) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(bodyText ? { 'Content-Type': 'application/json' } : {}),
    },
    body: bodyText || undefined,
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

async function fetchAnalytics(base: string, token: string, orgId: string) {
  const todayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  const body = JSON.stringify({
    reportRequests: [
      {
        timeRanges: [{ startsAt: todayStart, endsAt: Date.now() }],
        dimensions: [{ name: 'vs:driver' }],
        metrics: [
          { expression: 'vs:TotalTrips' },
          { expression: 'vs:HoursOnTrip' },
          { expression: 'vs:HoursOnline' },
        ],
        pagination_options: { pageSize: 1000 },
      },
    ],
    orgId: { orgUuid: orgId },
  })
  const res = await rawCall(base, '/v1/vehicle-suppliers/analytics-data/query', 'POST', token, body)
  const map: Record<string, { trips: number; hoursOnTrip: number }> = {}
  if (res.status === 200) {
    const reports = res.json?.body?.reports || res.json?.reports || []
    for (const rep of reports) {
      for (const trd of rep?.data?.timeRangeData || []) {
        for (const row of trd.rows || []) {
          const id = row.dimensionId
          const mv = row.metricValues || []
          if (id) map[id] = { trips: Number(mv[0]) || 0, hoursOnTrip: Number(mv[1]) || 0 }
        }
      }
    }
  }
  return map
}

async function ping(envName: EnvName, pastedToken?: string, scopeOverride?: string | null) {
  const base = cfg.base[envName] || cfg.base.sandbox
  const token = pastedToken || (await mintToken(envName, scopeOverride))
  const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
  if (orgsRes.status !== 200) {
    const err: any = new Error(orgsRes.json?.message || `Uber orgs respondió ${orgsRes.status}`)
    err.status = orgsRes.status === 401 || orgsRes.status === 403 ? 401 : 502
    err.kind = err.status === 401 ? 'auth' : 'http'
    throw err
  }
  return { ok: true, orgs: (orgsRes.json.organizations || []).length }
}

async function fetchFleet(envName: EnvName, pastedToken?: string, scopeOverride?: string | null) {
  const base = cfg.base[envName] || cfg.base.sandbox
  const token = pastedToken || (await mintToken(envName, scopeOverride))

  const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
  if (orgsRes.status !== 200) {
    const err: any = new Error(orgsRes.json?.message || `Uber orgs respondió ${orgsRes.status}`)
    err.status = orgsRes.status === 401 || orgsRes.status === 403 ? 401 : 502
    err.kind = err.status === 401 ? 'auth' : 'http'
    throw err
  }
  const orgs = orgsRes.json.organizations || []
  const parentIds = new Set(orgs.map((o: any) => o.parent_org_id).filter(Boolean))
  const targets = orgs.filter((o: any) => !parentIds.has(o.id))
  const useOrgs = targets.length ? targets : orgs

  const riders: any[] = []
  const seen = new Set<string>()
  let onTrip = 0
  let totalTrips = 0
  let totalHoursOnTrip = 0

  for (const org of useOrgs) {
    const enc = encodeURIComponent(org.id)
    const overviews = await fetchDriverActions(base, token, enc)
    const metrics = await fetchAnalytics(base, token, org.id)

    for (const o of overviews) {
      const di = o.driverInfo || {}
      const id = di.driverUuid
      if (!id || seen.has(id)) continue
      seen.add(id)
      const entry = latestEntry(o.statusEntries)
      const status = entry?.status || null
      const statusSince = entry?.timestamp ? Date.parse(entry.timestamp) : null
      if (status === 'DRIVER_STATUS_ONTRIP') onTrip += 1
      const m = metrics[id] || ({} as any)
      totalTrips += m.trips || 0
      totalHoursOnTrip += m.hoursOnTrip || 0
      riders.push({
        driverId: id,
        firstName: di.firstName,
        lastName: di.lastName,
        phone: di.phone,
        email: di.email,
        orgId: org.id,
        orgName: org.name,
        status,
        statusSince,
        licensePlate: o.vehicleInfo?.licensePlate || null,
        tripsToday: m.trips || 0,
        onboardingStatus: o.onboardingStatus || null,
      })
    }
  }

  const avgMinutes = totalTrips > 0 ? (totalHoursOnTrip / totalTrips) * 60 : 0
  return {
    orgs: useOrgs.map((o: any) => ({ id: o.id, name: o.name })),
    riders,
    metrics: { ordersInProgress: onTrip, completedToday: totalTrips, avgMinutes, openIncidents: 0 },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Exigir usuario real de Supabase (no solo la anon key, que es pública).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  if (!cfg.clientId || !cfg.clientSecret) {
    return json(503, { error: 'not_configured', message: 'Faltan UBER_CLIENT_ID / UBER_CLIENT_SECRET en los secrets de la función.' })
  }

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/uber/, '') || '/'
  const envName: EnvName = url.searchParams.get('env') === 'production' ? 'production' : 'sandbox'
  const pastedToken = req.headers.get('x-uber-token') || ''
  const scopeOverride = url.searchParams.has('scope') ? url.searchParams.get('scope') : undefined

  try {
    if (path === '/health' || path === '/') {
      return json(200, {
        configured: Boolean(cfg.clientId && cfg.clientSecret),
        hasClientId: Boolean(cfg.clientId),
        hasSecret: Boolean(cfg.clientSecret),
        scopeSet: Boolean(cfg.scope),
        tokenUrl: cfg.tokenUrl,
        base: cfg.base,
      })
    }
    if (path === '/ping') return json(200, await ping(envName, pastedToken, scopeOverride))
    if (path === '/fleet') return json(200, await fetchFleet(envName, pastedToken, scopeOverride))
    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message })
  }
})
