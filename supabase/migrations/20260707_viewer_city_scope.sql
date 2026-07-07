-- =====================================================================
-- Rol "viewer" (solo lectura) + ámbito de ciudades por miembro (city_scope).
-- Permite crear usuarios que solo ven los riders de ciertas ciudades
-- (p. ej. Bilbao + Tenerife). El filtro por ciudad se aplica en el frontend;
-- aquí solo persistimos el rol y el ámbito por miembro/invitación.
-- Idempotente: se puede aplicar más de una vez sin efectos secundarios.
-- =====================================================================

-- ===== 1. Ampliar los CHECK de role para incluir 'viewer' =====
-- Elimina CUALQUIER CHECK sobre la columna role (sea cual sea su nombre auto-generado)
-- en ambas tablas, para no dejar un constraint antiguo que rechace 'viewer'.
do $$
declare r record;
begin
  for r in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where conrelid in ('public.org_members'::regclass, 'public.org_invitations'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.org_members     add constraint org_members_role_check
  check (role in ('owner','admin','member','viewer'));
alter table public.org_invitations add constraint org_invitations_role_check
  check (role in ('owner','admin','member','viewer'));

-- ===== 2. Columna city_scope (null = sin restricción; array = ciudades permitidas) =====
alter table public.org_members     add column if not exists city_scope text[];
alter table public.org_invitations add column if not exists city_scope text[];

-- ===== 3. list_org_members ahora devuelve también city_scope =====
create or replace function public.list_org_members(p_org uuid)
returns table(user_id uuid, email text, full_name text, role text, city_scope text[], created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.city_scope, m.created_at
  from public.org_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org and public.is_org_member(p_org)
  order by m.created_at;
$$;
revoke execute on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- ===== 4. accept_pending_invitations: crea la membresía copiando role + city_scope =====
-- Acepta automáticamente las invitaciones pendientes (no caducadas) del email del usuario
-- que inicia sesión, trasladando el rol y el ámbito de ciudades definidos en la invitación.
create or replace function public.accept_pending_invitations()
returns integer language plpgsql security definer set search_path = public as $$
declare v_email text; v_count int := 0;
begin
  if auth.uid() is null then return 0; end if;
  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();
  if v_email is null then return 0; end if;

  insert into public.org_members (org_id, user_id, role, city_scope)
  select i.org_id, auth.uid(), i.role, i.city_scope
  from public.org_invitations i
  where lower(i.email) = v_email
    and i.status = 'pending'
    and i.expires_at > now()
  on conflict (org_id, user_id) do nothing;

  get diagnostics v_count = row_count;

  update public.org_invitations i
  set status = 'accepted'
  where lower(i.email) = v_email
    and i.status = 'pending'
    and i.expires_at > now();

  return v_count;
end $$;
revoke execute on function public.accept_pending_invitations() from public;
grant execute on function public.accept_pending_invitations() to authenticated;
