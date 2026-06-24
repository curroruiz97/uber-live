// Edge Function (Deno): proxy de Uber Vehicle Solutions — MULTI-TENANT.
// Resuelve la organización del llamante (header x-org-id, validado contra org_members)
// y carga sus credenciales de Uber desde org_integrations/org_secrets (service_role),
// con fallback a los secrets de entorno (para la org Sapiens durante la transición).
// El client_secret nunca llega al navegador. Cachea el token OAuth por org+entorno+scope.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-uber-token, x-org-id',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Config GLOBAL (endpoints + fallback de credenciales por entorno).
const envCfg = {
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
type Creds = { clientId: string; clientSecret: string; scope: string }
const tokenCache = new Map<string, { token: string; expiresAt: number }>()
const cooldownUntil = new Map<string, number>()
const COOLDOWN_MS = 5 * 60_000

async function mintToken(orgId: string, creds: Creds, envName: EnvName, scopeOverride?: string | null, force?: boolean, adminClient?: any) {
  const scope = scopeOverride != null ? scopeOverride : creds.scope
  const cacheKey = `${orgId}:${envName}:${scope}`

  // Cooldown: si Uber devolvió 429, no reintentar durante 5 min
  const cd = cooldownUntil.get(cacheKey)
  if (cd && cd > Date.now() && !force) {
    const err: any = new Error('OAuth rate limited — reintentando en unos minutos.')
    err.status = 429
    err.kind = 'rate_limit'
    throw err
  }

  if (!force) {
    // L1: in-memory (same isolate)
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
    // L2: DB (survives across isolates)
    if (adminClient && orgId) {
      const { data: row } = await adminClient.from('org_secrets').select('uber_token, uber_token_expires_at').eq('org_id', orgId).maybeSingle()
      if (row?.uber_token && row?.uber_token_expires_at) {
        const dbExpiry = new Date(row.uber_token_expires_at).getTime()
        if (row.uber_token === 'RATE_LIMITED') {
          if (dbExpiry > Date.now()) {
            cooldownUntil.set(cacheKey, dbExpiry)
            const err: any = new Error('OAuth rate limited — reintentando en unos minutos.')
            err.status = 429
            err.kind = 'rate_limit'
            throw err
          }
        } else if (dbExpiry > Date.now() + 60_000) {
          tokenCache.set(cacheKey, { token: row.uber_token, expiresAt: dbExpiry })
          return row.uber_token
        }
      }
    }
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  })
  if (scope) body.set('scope', scope)
  const res = await fetch(envCfg.tokenUrl[envName] || envCfg.tokenUrl.sandbox, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    if (res.status === 429) {
      const cooldownEnd = Date.now() + COOLDOWN_MS
      cooldownUntil.set(cacheKey, cooldownEnd)
      if (adminClient && orgId) {
        await adminClient.from('org_secrets').update({
          uber_token: 'RATE_LIMITED',
          uber_token_expires_at: new Date(cooldownEnd).toISOString(),
        }).eq('org_id', orgId).then(() => {})
      }
    }
    const err: any = new Error(`OAuth ${res.status}: ${data.error_description || data.error || JSON.stringify(data)}`)
    err.status = res.status === 429 ? 429 : 401
    err.kind = res.status === 429 ? 'rate_limit' : 'oauth'
    throw err
  }
  cooldownUntil.delete(cacheKey)
  const ttlMs = data.expires_in ? data.expires_in * 1000 : 3_600_000
  const expiresAt = Date.now() + ttlMs
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt })
  // Persist to DB
  if (adminClient && orgId) {
    await adminClient.from('org_secrets').update({
      uber_token: data.access_token,
      uber_token_expires_at: new Date(expiresAt).toISOString(),
    }).eq('org_id', orgId).then(() => {})
  }
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

async function ping(orgId: string, creds: Creds, envName: EnvName, pastedToken?: string, scopeOverride?: string | null, adminClient?: any) {
  const base = envCfg.base[envName] || envCfg.base.sandbox
  const token = pastedToken || (await mintToken(orgId, creds, envName, scopeOverride, false, adminClient))
  const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
  if (orgsRes.status !== 200) {
    const err: any = new Error(orgsRes.json?.message || `Uber orgs respondió ${orgsRes.status}`)
    err.status = orgsRes.status === 401 || orgsRes.status === 403 ? 401 : 502
    err.kind = err.status === 401 ? 'auth' : 'http'
    throw err
  }
  return { ok: true, orgs: (orgsRes.json.organizations || []).length }
}

async function fetchFleet(orgId: string, creds: Creds, envName: EnvName, pastedToken?: string, scopeOverride?: string | null, adminClient?: any) {
  const base = envCfg.base[envName] || envCfg.base.sandbox
  const token = pastedToken || (await mintToken(orgId, creds, envName, scopeOverride, false, adminClient))

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

// Resuelve la org del llamante y carga sus credenciales (con fallback a env).
async function resolveOrgCreds(userClient: any, adminClient: any, requestedOrgId: string) {
  // org del usuario: si llega x-org-id, validar pertenencia; si no, su primera org.
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
      adminClient.from('org_integrations').select('*').eq('org_id', orgId).maybeSingle(),
      adminClient.from('org_secrets').select('*').eq('org_id', orgId).maybeSingle(),
    ])
    integ = i
    secrets = s
  }
  const creds: Creds = {
    clientId: integ?.uber_client_id || envCfg.clientId,
    clientSecret: secrets?.uber_client_secret || envCfg.clientSecret,
    scope: integ?.uber_scope || envCfg.scope,
  }
  return { orgId, creds, integ }
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
  const path = url.pathname.replace(/^\/uber/, '') || '/'
  const envName: EnvName = url.searchParams.get('env') === 'production' ? 'production' : 'sandbox'
  const pastedToken = req.headers.get('x-uber-token') || ''
  const scopeOverride = url.searchParams.has('scope') ? url.searchParams.get('scope') : undefined
  const requestedOrgId = req.headers.get('x-org-id') || url.searchParams.get('org_id') || ''

  try {
    const { orgId, creds } = await resolveOrgCreds(userClient, adminClient, requestedOrgId)

    if (path === '/health' || path === '/') {
      return json(200, {
        orgId,
        configured: Boolean(creds.clientId && creds.clientSecret),
        hasClientId: Boolean(creds.clientId),
        hasSecret: Boolean(creds.clientSecret),
        scopeSet: Boolean(creds.scope),
      })
    }

    if (!creds.clientId || !creds.clientSecret) {
      return json(503, { error: 'not_configured', message: 'Esta organización no tiene configuradas las credenciales de Uber.' })
    }

    if (path === '/ping') return json(200, await ping(orgId, creds, envName, pastedToken, scopeOverride, adminClient))
    if (path === '/fleet') {
      const fleet = await fetchFleet(orgId, creds, envName, pastedToken, scopeOverride, adminClient)
      const { data: sub } = await adminClient.from('subscriptions').select('rider_limit').eq('org_id', orgId).maybeSingle()
      const riderLimit = sub?.rider_limit ?? null
      return json(200, { ...fleet, riderLimit, overLimit: riderLimit != null && (fleet.riders?.length || 0) > riderLimit })
    }
    return json(404, { error: 'not_found', message: `Ruta no soportada: ${path}` })
  } catch (e: any) {
    return json(e.status || 500, { error: e.kind || 'proxy_error', message: e.message })
  }
})
