import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'No autenticado' })

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const orgId = req.headers.get('x-org-id') || ''
  if (!orgId) return json(400, { error: 'Falta x-org-id' })

  // Verificar que el caller es owner/admin de la org
  const { data: membership } = await userClient
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle()
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return json(403, { error: 'No tienes permisos para invitar' })
  }

  let body: { email?: string; role?: string; city_scope?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Body JSON inválido' })
  }

  const email = (body.email || '').trim().toLowerCase()
  const role = body.role || 'member'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: 'Email no válido' })
  }
  if (!['member', 'admin', 'viewer'].includes(role)) {
    return json(400, { error: 'Role debe ser member, admin o viewer' })
  }

  // Ámbito de ciudades (opcional): lista de nombres de ciudad que este usuario podrá ver.
  // Solo tiene sentido para roles de lectura; para admin/owner se ignora (ven todo).
  let cityScope: string[] | null = null
  if (Array.isArray(body.city_scope)) {
    const cleaned = body.city_scope
      .map((c) => String(c || '').trim())
      .filter((c) => c.length > 0)
    cityScope = cleaned.length ? cleaned : null
  }
  if (role === 'admin') cityScope = null

  // Comprobar si ya es miembro de la org (buscar por email via RPC que une auth.users)
  const { data: allMembers } = await adminClient.rpc('list_org_members', { p_org: orgId })
  const alreadyMember = (allMembers || []).some(
    (m: { email: string }) => m.email?.toLowerCase() === email,
  )
  if (alreadyMember) {
    return json(409, { error: 'Esta persona ya es miembro del equipo' })
  }

  // Comprobar si ya existe una invitación pendiente
  const { data: existingInvite } = await adminClient
    .from('org_invitations')
    .select('id')
    .eq('org_id', orgId)
    .ilike('email', email)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()
  if (existingInvite) {
    return json(409, { error: 'Ya existe una invitación pendiente para este email' })
  }

  // Insertar invitación (con adminClient para evitar problemas de RLS)
  const { error: insertErr } = await adminClient.from('org_invitations').insert({
    org_id: orgId,
    email,
    role,
    city_scope: cityScope,
    invited_by: user.id,
  })
  if (insertErr) return json(500, { error: insertErr.message })

  // Obtener el nombre de la org para el email
  const { data: org } = await adminClient
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()
  const orgName = org?.name || 'el equipo'

  // Intentar enviar email de invitación via Supabase Auth
  let emailSent = false
  let alreadyRegistered = false

  const siteUrl = Deno.env.get('SITE_URL') || 'https://uber-live.vercel.app'

  const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl,
    data: { invited_org_id: orgId, invited_org_name: orgName },
  })

  if (!inviteErr) {
    emailSent = true
  } else {
    alreadyRegistered = true
    // El usuario ya existe. Intentar enviar magic link para que inicie sesión.
    // generateLink genera la URL pero no envía el email directamente;
    // sin embargo, signInWithOtp SÍ envía el email.
    try {
      const { error: otpErr } = await adminClient.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: siteUrl },
      })
      if (!otpErr) emailSent = true
    } catch {
      // No critical - invitation stored anyway
    }
  }

  return json(200, {
    success: true,
    emailSent,
    alreadyRegistered,
    orgName,
  })
})
