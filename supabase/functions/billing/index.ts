// Edge Function (Deno): facturación con Stripe. DORMIDA hasta definir STRIPE_SECRET_KEY.
// /config devuelve el catálogo de precios (siempre). /checkout /portal /topup requieren
// Stripe configurado y rol owner/admin de la organización (x-org-id).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://uber-live.vercel.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'unauthorized', message: 'Sesión no válida.' })

  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/billing/, '') || '/'
  const orgId = req.headers.get('x-org-id') || ''

  // Catálogo de precios (no requiere Stripe).
  if (path === '/config' || path === '/') {
    const { data } = await userClient.from('billing_prices').select('*').eq('active', true)
    return json(200, { configured: Boolean(STRIPE_KEY), prices: data || [] })
  }

  if (!STRIPE_KEY) return json(503, { error: 'not_configured', message: 'Stripe aún no está configurado.' })
  if (!orgId) return json(400, { error: 'no_org', message: 'Falta la organización.' })

  // Filtra por el propio usuario: por RLS se ven todas las filas de la org y, con varias,
  // maybeSingle fallaría (y podría devolver el rol de otro miembro).
  const { data: mem } = await userClient.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) {
    return json(403, { error: 'forbidden', message: 'Solo owner/admin pueden gestionar la facturación.' })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const Stripe = (await import('npm:stripe@16')).default
  const stripe = new Stripe(STRIPE_KEY, { httpClient: Stripe.createFetchHttpClient() })
  const body = await req.json().catch(() => ({}))

  async function ensureCustomer() {
    const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id').eq('org_id', orgId).maybeSingle()
    if (sub?.stripe_customer_id) return sub.stripe_customer_id
    const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).maybeSingle()
    const cust = await stripe.customers.create({ name: org?.name ?? undefined, email: user.email ?? undefined, metadata: { org_id: orgId } })
    await admin.from('subscriptions').update({ stripe_customer_id: cust.id }).eq('org_id', orgId)
    return cust.id
  }

  try {
    if (path === '/checkout') {
      const customer = await ensureCustomer()
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer,
        line_items: [{ price: body.price_id, quantity: 1 }],
        subscription_data: { trial_period_days: 14, metadata: { org_id: orgId } },
        success_url: `${SITE_URL}/?billing=success`,
        cancel_url: `${SITE_URL}/?billing=cancel`,
      })
      return json(200, { url: session.url })
    }
    if (path === '/portal') {
      const customer = await ensureCustomer()
      const ps = await stripe.billingPortal.sessions.create({ customer, return_url: SITE_URL })
      return json(200, { url: ps.url })
    }
    if (path === '/topup') {
      const customer = await ensureCustomer()
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer,
        line_items: [{ price: body.price_id, quantity: 1 }],
        metadata: { org_id: orgId, topup: '1', price_id: body.price_id },
        success_url: `${SITE_URL}/?billing=topup`,
        cancel_url: `${SITE_URL}/?billing=cancel`,
      })
      return json(200, { url: session.url })
    }
    return json(404, { error: 'not_found' })
  } catch (e: any) {
    return json(500, { error: 'stripe_error', message: e.message })
  }
})
