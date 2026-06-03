// Edge Function (Deno): CAPTURA periódica de actividad de riders (cron, sin usuario).
// La invoca pg_cron cada ~10 min con un secreto de cabecera. Con service_role itera
// las orgs con suscripción activa e integraciones configuradas, llama a los fetchers
// _shared (Uber/Glovo) y registra una muestra por rider + actualiza el roster.
//
// NO expone datos al navegador: se protege con X-Cron-Secret (no verify_jwt de usuario).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { captureUberFleet } from '../_shared/uberFleet.ts'
import { captureGlovoFleet } from '../_shared/glovoFleet.ts'

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

// Estado interno del rider -> etiqueta interna usada por el resto de la app.
function internalStatus(r: any): string {
  if (r.onTrip) return 'en_entrega'
  if (r.online) return 'disponible'
  return 'offline'
}

// rider_key estable: teléfono solo dígitos; si no hay, el id del proveedor.
function riderKey(r: any): string {
  const digits = String(r.phone || '').replace(/\D/g, '')
  return digits || `${r.provider}:${r.providerRiderId}`
}

async function captureOrg(admin: any, orgId: string, integ: any, secrets: any) {
  const now = new Date().toISOString()
  const all: any[] = []

  // Uber
  if (integ.uber_configured && (secrets.uber_client_secret || Deno.env.get('UBER_CLIENT_SECRET'))) {
    try {
      const creds = {
        clientId: integ.uber_client_id || Deno.env.get('UBER_CLIENT_ID') || '',
        clientSecret: secrets.uber_client_secret || Deno.env.get('UBER_CLIENT_SECRET') || '',
        scope: integ.uber_scope || Deno.env.get('UBER_SCOPE') || '',
      }
      const env = integ.uber_environment === 'production' ? 'production' : 'sandbox'
      const riders = await captureUberFleet(orgId, creds, env)
      all.push(...riders)
    } catch (e) {
      console.error(`[capture] uber org=${orgId}:`, (e as Error).message)
    }
  }

  // Glovo
  if (integ.glovo_configured && (secrets.glovo_private_key || Deno.env.get('GLOVO_PRIVATE_KEY'))) {
    try {
      const creds = {
        clientId: integ.glovo_client_id || Deno.env.get('GLOVO_CLIENT_ID') || '',
        kid: integ.glovo_kid || Deno.env.get('GLOVO_KID') || '',
        privateKey: secrets.glovo_private_key || Deno.env.get('GLOVO_PRIVATE_KEY') || '',
        companyId: integ.glovo_company_id || Deno.env.get('GLOVO_COMPANY_ID') || '',
        cityCodes: integ.glovo_city_codes || Deno.env.get('GLOVO_CITY_CODES') || '',
        liveScope: Deno.env.get('GLOVO_LIVE_SCOPE') || '',
      }
      const env = integ.glovo_environment === 'production' ? 'production' : 'staging'
      const riders = await captureGlovoFleet(orgId, creds, env)
      all.push(...riders)
    } catch (e) {
      console.error(`[capture] glovo org=${orgId}:`, (e as Error).message)
    }
  }

  if (!all.length) return { riders: 0 }

  // Upsert roster + insert muestras (en lote).
  const rosterRows = all.map((r) => ({
    org_id: orgId,
    rider_key: riderKey(r),
    provider: r.provider,
    provider_rider_id: r.providerRiderId,
    name: r.name || null,
    phone: r.phone || null,
    email: r.email || null,
    last_seen: now,
  }))
  const sampleRows = all.map((r) => ({
    org_id: orgId,
    rider_key: riderKey(r),
    provider: r.provider,
    captured_at: now,
    status: internalStatus(r),
    online: Boolean(r.online),
    on_trip: Boolean(r.onTrip),
    lat: r.lat,
    lng: r.lng,
    active_deliveries: r.activeDeliveries || 0,
  }))

  // upsert roster (no pisa first_seen; actualiza last_seen y datos).
  await admin.from('rider_roster').upsert(rosterRows, { onConflict: 'org_id,rider_key' })
  await admin.from('rider_activity_samples').insert(sampleRows)
  return { riders: all.length }
}

Deno.serve(async (req) => {
  // Protección: secreto de cron en cabecera (no usuario).
  const secret = req.headers.get('x-cron-secret') || ''
  const expected = Deno.env.get('CRON_SECRET') || ''
  if (!expected || secret !== expected) return json(401, { error: 'unauthorized' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Orgs con suscripción activa/trial.
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
      const r = await captureOrg(admin, integ.org_id, integ, secByOrg.get(integ.org_id) || {})
      totalRiders += r.riders
      okOrgs += 1
    } catch (e) {
      console.error(`[capture] org=${integ.org_id}:`, (e as Error).message)
    }
  }

  return json(200, { ok: true, orgs: okOrgs, riders: totalRiders })
})
