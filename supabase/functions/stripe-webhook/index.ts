// Edge Function (Deno): webhook de Stripe. DORMIDA hasta definir STRIPE_WEBHOOK_SECRET.
// Verifica la firma sobre el cuerpo RAW, es idempotente (stripe_events) y sincroniza
// subscriptions + créditos mediante RPCs (service_role). verify_jwt = false: Stripe no
// envía JWT de Supabase; la seguridad es la firma del webhook.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

async function orgByCustomer(db: any, customerId: string) {
  const { data } = await db.from('subscriptions').select('org_id').eq('stripe_customer_id', customerId).maybeSingle()
  return data?.org_id || null
}
async function priceInfo(db: any, priceId: string) {
  const { data } = await db.from('billing_prices').select('*').eq('id', priceId).maybeSingle()
  return data
}

Deno.serve(async (req) => {
  if (!STRIPE_KEY || !WEBHOOK_SECRET) return new Response('not configured', { status: 503 })

  const sig = req.headers.get('stripe-signature') ?? ''
  const raw = await req.text()
  const Stripe = (await import('npm:stripe@16')).default
  const stripe = new Stripe(STRIPE_KEY, { httpClient: Stripe.createFetchHttpClient() })

  let event: any
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider())
  } catch (_e) {
    return new Response('bad signature', { status: 400 })
  }

  const db = admin()
  // Idempotencia: si el evento ya está, salir OK.
  const { error: dup } = await db.from('stripe_events').insert({ event_id: event.id })
  if (dup) return new Response('ok (dup)', { status: 200 })

  const obj = event.data.object
  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const orgId = obj.metadata?.org_id || (await orgByCustomer(db, obj.customer))
      if (orgId) {
        const price = obj.items?.data?.[0]?.price?.id
        const info = price ? await priceInfo(db, price) : null
        await db.from('subscriptions').update({
          status: obj.status,
          tier: info?.tier ?? 'custom',
          price_id: price,
          rider_limit: info?.rider_limit ?? null,
          included_credits: info?.included_credits ?? 0,
          stripe_subscription_id: obj.id,
          current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: Boolean(obj.cancel_at_period_end),
          updated_at: new Date().toISOString(),
        }).eq('org_id', orgId)
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const orgId = await orgByCustomer(db, obj.customer)
      if (orgId) await db.from('subscriptions').update({ status: 'canceled' }).eq('org_id', orgId)
    } else if (event.type === 'invoice.paid') {
      const orgId = await orgByCustomer(db, obj.customer)
      if (orgId) {
        const { data: sub } = await db.from('subscriptions').select('included_credits,last_included_grant').eq('org_id', orgId).maybeSingle()
        if (sub) {
          const delta = (sub.included_credits || 0) - (sub.last_included_grant || 0)
          if (delta !== 0) await db.rpc('grant_credits', { p_org: orgId, p_amount: delta, p_bucket: 'included', p_reason: 'period_reset', p_channel: null, p_ref: null })
          await db.from('subscriptions').update({ last_included_grant: sub.included_credits }).eq('org_id', orgId)
        }
      }
    } else if (event.type === 'invoice.payment_failed') {
      const orgId = await orgByCustomer(db, obj.customer)
      if (orgId) await db.from('subscriptions').update({ status: 'past_due' }).eq('org_id', orgId)
    } else if (event.type === 'checkout.session.completed' && obj.mode === 'payment') {
      const orgId = obj.metadata?.org_id
      const info = obj.metadata?.price_id ? await priceInfo(db, obj.metadata.price_id) : null
      if (orgId && info?.credit_amount) {
        await db.rpc('grant_credits', { p_org: orgId, p_amount: info.credit_amount, p_bucket: 'topup', p_reason: 'topup', p_channel: null, p_ref: null })
      }
    }
  } catch (_e) {
    return new Response('handler error', { status: 500 })
  }
  return new Response('ok', { status: 200 })
})
