// =============================================================================
// Servicio de Uber (Vehicle Solutions) — lógica pura, sin Express ni Vite.
//
// Guarda el client_secret server-side, hace OAuth (client_credentials), cachea el
// token y fusiona orgs -> drivers/actions (estado) + analytics (métricas hoy) en
// { orgs, riders[], metrics }. Los routers de Express lo consumen.
//
// Config vía process.env (ver .env.example).
// =============================================================================

export function createUberService(env = process.env) {
  const cfg = {
    clientId: env.UBER_CLIENT_ID || '',
    clientSecret: env.UBER_CLIENT_SECRET || '',
    scope: env.UBER_SCOPE || '',
    tokenUrl: {
      sandbox: env.UBER_TOKEN_URL_SANDBOX || 'https://sandbox-login.uber.com/oauth/v2/token',
      production:
        env.UBER_TOKEN_URL_PROD || env.UBER_TOKEN_URL || 'https://auth.uber.com/oauth/v2/token',
    },
    base: {
      sandbox: env.UBER_SANDBOX_BASE || 'https://test-api.uber.com',
      production: env.UBER_PROD_BASE || 'https://api.uber.com',
    },
    deliveriesPath: env.UBER_DELIVERIES_PATH || '/v1/deliveries',
    deliveryPath: env.UBER_DELIVERY_PATH || '/v1/deliveries/{id}',
  }

  const tokenCache = new Map()

  async function mintToken(envName, scopeOverride, force) {
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
    const tokenUrl = cfg.tokenUrl[envName] || cfg.tokenUrl.sandbox
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) {
      const err = new Error(
        `OAuth ${res.status}: ${data.error_description || data.error || JSON.stringify(data)}`,
      )
      err.status = 401
      err.kind = 'oauth'
      err.uber = data
      throw err
    }
    const ttlMs = data.expires_in ? data.expires_in * 1000 : 3_600_000
    tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlMs })
    return data.access_token
  }

  async function callUber(envName, path, method, bodyText, pastedToken, scopeOverride) {
    const base = cfg.base[envName] || cfg.base.sandbox
    const doFetch = (tk) =>
      fetch(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${tk}`,
          Accept: 'application/json',
          ...(bodyText ? { 'Content-Type': 'application/json' } : {}),
        },
        body: bodyText || undefined,
      })
    let token = pastedToken || (await mintToken(envName, scopeOverride))
    let r = await doFetch(token)
    if (r.status === 401 && !pastedToken) {
      token = await mintToken(envName, scopeOverride, true)
      r = await doFetch(token)
    }
    const text = await r.text()
    let json
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = { raw: text }
    }
    return { status: r.status, json }
  }

  // Llamada simple reutilizando un token ya obtenido (flujo multi-paso de /fleet).
  async function rawCall(base, path, method, token, bodyText) {
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
    let json
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      json = { raw: text }
    }
    return { status: r.status, json }
  }

  // Entrada de estado más reciente (status + timestamp) de statusEntries.
  function latestEntry(entries) {
    if (!Array.isArray(entries) || !entries.length) return null
    let best = entries[0]
    for (const e of entries) if ((e.timestamp || '') > (best.timestamp || '')) best = e
    return best
  }

  // GET drivers/actions paginado -> overviews con estado, identidad y matrícula.
  async function fetchDriverActions(base, token, orgEnc) {
    const out = []
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

  // POST analytics-data/query -> métricas de HOY por conductor (uuid -> {trips, hoursOnTrip}).
  async function fetchAnalytics(base, token, orgId) {
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
    const map = {}
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

  // Validación ligera: solo orgs. Rápida (no descarga la flota).
  async function ping(envName, pastedToken, scopeOverride) {
    const base = cfg.base[envName] || cfg.base.sandbox
    const token = pastedToken || (await mintToken(envName, scopeOverride))
    const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
    if (orgsRes.status !== 200) {
      const err = new Error(orgsRes.json?.message || `Uber orgs respondió ${orgsRes.status}`)
      err.status = orgsRes.status === 401 || orgsRes.status === 403 ? 401 : 502
      err.kind = err.status === 401 ? 'auth' : 'http'
      err.uber = orgsRes.json
      throw err
    }
    return { ok: true, orgs: (orgsRes.json.organizations || []).length }
  }

  // Flujo completo Vehicle Solutions. Las llamadas van secuenciales (escalonadas) por org.
  async function fetchFleet(envName, pastedToken, scopeOverride) {
    const base = cfg.base[envName] || cfg.base.sandbox
    const token = pastedToken || (await mintToken(envName, scopeOverride))

    const orgsRes = await rawCall(base, '/v1/vehicle-suppliers/orgs', 'GET', token)
    if (orgsRes.status !== 200) {
      const err = new Error(orgsRes.json?.message || `Uber orgs respondió ${orgsRes.status}`)
      err.status = orgsRes.status === 401 || orgsRes.status === 403 ? 401 : 502
      err.kind = err.status === 401 ? 'auth' : 'http'
      err.uber = orgsRes.json
      throw err
    }
    const orgs = orgsRes.json.organizations || []
    const parentIds = new Set(orgs.map((o) => o.parent_org_id).filter(Boolean))
    const targets = orgs.filter((o) => !parentIds.has(o.id))
    const useOrgs = targets.length ? targets : orgs

    const riders = []
    const seen = new Set()
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
        // Momento en que entró en el estado actual (ms). Para ONTRIP = inicio del viaje.
        const statusSince = entry?.timestamp ? Date.parse(entry.timestamp) : null
        if (status === 'DRIVER_STATUS_ONTRIP') onTrip += 1
        const m = metrics[id] || {}
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
      orgs: useOrgs.map((o) => ({ id: o.id, name: o.name })),
      riders,
      metrics: {
        ordersInProgress: onTrip,
        completedToday: totalTrips,
        avgMinutes,
        openIncidents: 0,
      },
    }
  }

  return {
    isConfigured: () => Boolean(cfg.clientId && cfg.clientSecret),
    getHealth: () => ({
      configured: Boolean(cfg.clientId && cfg.clientSecret),
      hasClientId: Boolean(cfg.clientId),
      hasSecret: Boolean(cfg.clientSecret),
      scopeSet: Boolean(cfg.scope),
      tokenUrl: cfg.tokenUrl,
      base: cfg.base,
    }),
    ping,
    fetchFleet,
    deliveries: (envName, token, scope) =>
      callUber(envName, cfg.deliveriesPath, 'GET', null, token, scope),
    delivery: (id, envName, token, scope) =>
      callUber(envName, cfg.deliveryPath.replace('{id}', encodeURIComponent(id)), 'GET', null, token, scope),
  }
}
