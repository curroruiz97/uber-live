// Edge Function (Deno): CAPTURA periódica de actividad de riders (cron, sin usuario).
// La invoca pg_cron cada ~10 min con el secreto de cron (almacenado en public.cron_config,
// no como env var). Con service_role itera las orgs con suscripción activa e integraciones
// configuradas, captura la flota (Uber Vehicle Solutions / Glovo Live Ops) y registra una
// muestra por rider + actualiza el roster. Self-contained (sin imports relativos).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

// ===================== Uber Vehicle Solutions =====================
const uberCfg = {
  tokenUrl: {
    sandbox: Deno.env.get('UBER_TOKEN_URL_SANDBOX') ?? 'https://sandbox-login.uber.com/oauth/v2/token',
    production: Deno.env.get('UBER_TOKEN_URL_PROD') ?? 'https://auth.uber.com/oauth/v2/token',
  },
  base: {
    sandbox: Deno.env.get('UBER_SANDBOX_BASE') ?? 'https://test-api.uber.com',
    production: Deno.env.get('UBER_PROD_BASE') ?? 'https://api.uber.com',
  },
}
const uberTokenCache = new Map<string, { token: string; expiresAt: number }>()

async function uberMint(cacheKey: string, creds: any, envName: string) {
  const cached = uberTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.clientId, client_secret: creds.clientSecret })
  if (creds.scope) body.set('scope', creds.scope)
  const res = await fetch(uberCfg.tokenUrl[envName] || uberCfg.tokenUrl.sandbox, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Uber OAuth ${res.status}`)
  uberTokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3_600_000) })
  return data.access_token
}
async function uberCall(base: string, path: string, token: string) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
  const text = await r.text()
  let body: any
  try { body = text ? JSON.parse(text) : {} } catch { body = {} }
  return { status: r.status, json: body }
}
function latestEntry(entries: any[]) {
  if (!Array.isArray(entries) || !entries.length) return null
  let best = entries[0]
  for (const e of entries) if ((e.timestamp || '') > (best.timestamp || '')) best = e
  return best
}
async function captureUber(orgId: string, creds: any, envName: string) {
  const base = uberCfg.base[envName] || uberCfg.base.sandbox
  const token = await uberMint(`${orgId}:${envName}:${creds.scope}`, creds, envName)
  const orgsRes = await uberCall(base, '/v1/vehicle-suppliers/orgs', token)
  if (orgsRes.status !== 200) throw new Error(`Uber orgs ${orgsRes.status}`)
  const orgs = orgsRes.json.organizations || []
  const parentIds = new Set(orgs.map((o: any) => o.parent_org_id).filter(Boolean))
  const targets = orgs.filter((o: any) => !parentIds.has(o.id))
  const useOrgs = targets.length ? targets : orgs
  const riders: any[] = []
  const seen = new Set<string>()
  for (const org of useOrgs) {
    let pageToken = ''
    for (let i = 0; i < 25; i += 1) {
      const q = `?org_id=${encodeURIComponent(org.id)}&page_size=100${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''}`
      const res = await uberCall(base, `/v1/vehicle-suppliers/drivers/actions${q}`, token)
      if (res.status !== 200) break
      const body = res.json?.body || res.json || {}
      for (const o of body.driverStatusOverviews || []) {
        const di = o.driverInfo || {}
        const id = di.driverUuid
        if (!id || seen.has(id)) continue
        seen.add(id)
        const entry = latestEntry(o.statusEntries)
        const status = entry?.status || null
        const onTrip = status === 'DRIVER_STATUS_ONTRIP'
        const online = Boolean(status && status !== 'DRIVER_STATUS_OFFLINE')
        riders.push({ provider: 'uber', providerRiderId: id, name: `${di.firstName || ''} ${di.lastName || ''}`.trim(), phone: di.phone || null, email: di.email || null, online, onTrip, lat: null, lng: null, activeDeliveries: onTrip ? 1 : 0 })
      }
      pageToken = body.paginationResult?.nextPageToken || ''
      if (!pageToken) break
    }
  }
  return riders
}

// ===================== Glovo Live Operations =====================
const glovoCfg = {
  stsAud: Deno.env.get('GLOVO_STS_AUD') ?? 'https://sts.deliveryhero.io',
  sts: { staging: Deno.env.get('GLOVO_STS_STAGING') ?? 'https://sts-st.dh-auth.io/oauth2/token', production: Deno.env.get('GLOVO_STS_PROD') ?? 'https://sts.dh-auth.io/oauth2/token' },
  live: { staging: Deno.env.get('GLOVO_LIVE_STAGING') ?? 'https://gv-pl-st.usehurrier.com', production: Deno.env.get('GLOVO_LIVE_PROD') ?? 'https://gv-es.usehurrier.com' },
}
const glovoTokenCache = new Map<string, { token: string; expiresAt: number }>()
function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function pemToBuf(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}
async function glovoMint(orgId: string, creds: any, envName: string) {
  const cacheKey = `${orgId}:${envName}:${creds.liveScope}`
  const cached = glovoTokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: creds.kid }
  const payload = { aud: glovoCfg.stsAud, iss: creds.clientId, sub: creds.clientId, jti: crypto.randomUUID(), iat: now, exp: now + 60 }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey('pkcs8', pemToBuf(creds.privateKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput))
  const assertion = `${signingInput}.${b64url(sig)}`
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assertion })
  if (creds.liveScope) body.set('scope', creds.liveScope)
  const res = await fetch(glovoCfg.sts[envName] || glovoCfg.sts.staging, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(`Glovo STS ${res.status}`)
  glovoTokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 7_200_000) })
  return data.access_token
}
function parseCities(cityCodes: string) {
  return String(cityCodes || '').split(',').map((s) => s.trim()).filter(Boolean).map((part) => { const [a, b] = part.split(':').map((x) => x.trim()); return b ? { code: a, cityId: b } : { code: a, cityId: a } })
}
async function captureGlovo(orgId: string, creds: any, envName: string) {
  const base = glovoCfg.live[envName] || glovoCfg.live.staging
  const token = await glovoMint(orgId, creds, envName)
  const company = encodeURIComponent(creds.companyId)
  const riders: any[] = []
  for (const city of parseCities(creds.cityCodes)) {
    for (let page = 0; page < 50; page += 1) {
      const path = `/api/rider-live-operations/v2/external/city/${encodeURIComponent(city.cityId)}/riders?filter_companies=${company}&page=${page}&size=50`
      const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (r.status !== 200) break
      const body = await r.json().catch(() => ({}))
      const list = body.content || body.riders || body.data || []
      for (const item of list) {
        const loc = item.location || item.last_location || {}
        const lat = loc.lat ?? loc.latitude
        const lng = loc.lng ?? loc.lon ?? loc.longitude
        const status = String(item.status || item.state || '').toLowerCase()
        const online = status !== '' && status !== 'offline' && status !== 'break' && status !== 'ending'
        const deliveries = Number(item.deliveries ?? item.total_deliveries ?? 0)
        const id = String(item.id ?? item.courier_id ?? item.rider_id ?? '')
        if (!id) continue
        riders.push({ provider: 'glovo', providerRiderId: id, name: [item.first_name, item.last_name].filter(Boolean).join(' ') || item.name || '', phone: item.phone_number || item.phone || null, email: null, online, onTrip: deliveries > 0, lat: typeof lat === 'number' ? lat : null, lng: typeof lng === 'number' ? lng : null, activeDeliveries: deliveries })
      }
      if (body.last ?? (list.length < 50)) break
      await new Promise((res) => setTimeout(res, 250))
    }
  }
  return riders
}

// ===================== Captura por org =====================
function internalStatus(r: any) { return r.onTrip ? 'en_entrega' : r.online ? 'disponible' : 'offline' }
function riderKey(r: any) { const digits = String(r.phone || '').replace(/\D/g, ''); return digits || `${r.provider}:${r.providerRiderId}` }

async function captureOrg(admin: any, orgId: string, integ: any, secrets: any) {
  const now = new Date().toISOString()
  const all: any[] = []
  if (integ.uber_configured && (secrets.uber_client_secret || Deno.env.get('UBER_CLIENT_SECRET'))) {
    try {
      all.push(...await captureUber(orgId, {
        clientId: integ.uber_client_id || Deno.env.get('UBER_CLIENT_ID') || '',
        clientSecret: secrets.uber_client_secret || Deno.env.get('UBER_CLIENT_SECRET') || '',
        scope: integ.uber_scope || Deno.env.get('UBER_SCOPE') || '',
      }, integ.uber_environment === 'production' ? 'production' : 'sandbox'))
    } catch (e) { console.error(`[capture] uber ${orgId}:`, (e as Error).message) }
  }
  if (integ.glovo_configured && (secrets.glovo_private_key || Deno.env.get('GLOVO_PRIVATE_KEY'))) {
    try {
      all.push(...await captureGlovo(orgId, {
        clientId: integ.glovo_client_id || Deno.env.get('GLOVO_CLIENT_ID') || '',
        kid: integ.glovo_kid || Deno.env.get('GLOVO_KID') || '',
        privateKey: secrets.glovo_private_key || Deno.env.get('GLOVO_PRIVATE_KEY') || '',
        companyId: integ.glovo_company_id || Deno.env.get('GLOVO_COMPANY_ID') || '',
        cityCodes: integ.glovo_city_codes || Deno.env.get('GLOVO_CITY_CODES') || '',
        liveScope: Deno.env.get('GLOVO_LIVE_SCOPE') || '',
      }, integ.glovo_environment === 'production' ? 'production' : 'staging'))
    } catch (e) { console.error(`[capture] glovo ${orgId}:`, (e as Error).message) }
  }
  if (!all.length) return 0
  const rosterRows = all.map((r) => ({ org_id: orgId, rider_key: riderKey(r), provider: r.provider, provider_rider_id: r.providerRiderId, name: r.name || null, phone: r.phone || null, email: r.email || null, last_seen: now }))
  const sampleRows = all.map((r) => ({ org_id: orgId, rider_key: riderKey(r), provider: r.provider, captured_at: now, status: internalStatus(r), online: Boolean(r.online), on_trip: Boolean(r.onTrip), lat: r.lat, lng: r.lng, active_deliveries: r.activeDeliveries || 0 }))
  await admin.from('rider_roster').upsert(rosterRows, { onConflict: 'org_id,rider_key' })
  await admin.from('rider_activity_samples').insert(sampleRows)
  return all.length
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Secreto de cron desde la BD (public.cron_config, RLS bloquea al navegador).
  const { data: cc } = await admin.from('cron_config').select('secret').maybeSingle()
  const expected = cc?.secret || ''
  const given = req.headers.get('x-cron-secret') || ''
  if (!expected || given !== expected) return json(401, { error: 'unauthorized' })

  const { data: subs } = await admin.from('subscriptions').select('org_id, status')
  const activeOrgs = (subs || []).filter((s: any) => ['active', 'trialing'].includes(s.status)).map((s: any) => s.org_id)
  if (!activeOrgs.length) return json(200, { ok: true, orgs: 0 })

  const { data: integs } = await admin.from('org_integrations').select('*').in('org_id', activeOrgs)
  const { data: secs } = await admin.from('org_secrets').select('*').in('org_id', activeOrgs)
  const secByOrg = new Map((secs || []).map((s: any) => [s.org_id, s]))

  let totalRiders = 0
  let okOrgs = 0
  for (const integ of integs || []) {
    if (!integ.uber_configured && !integ.glovo_configured) continue
    try {
      totalRiders += await captureOrg(admin, integ.org_id, integ, secByOrg.get(integ.org_id) || {})
      okOrgs += 1
    } catch (e) { console.error(`[capture] org=${integ.org_id}:`, (e as Error).message) }
  }
  return json(200, { ok: true, orgs: okOrgs, riders: totalRiders })
})
