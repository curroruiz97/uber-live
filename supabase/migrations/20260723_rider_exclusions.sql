-- =====================================================================
-- BAJAS DE RIDERS (rider_exclusions) — riders que ya NO trabajan con la flota
-- ("despedidos") y deben desaparecer del cumplimiento SIN borrar su histórico.
--   - Baja REVERSIBLE: active=true oculta al rider en todas las vistas; restore
--     lo vuelve a mostrar. No se borra ninguna fila de actividad ni de turnos.
--   - Cruce por DOBLE clave: rider_key (teléfono, cuando se conoce) Y name_norm
--     (nombre normalizado), porque el Excel de la clienta solo trae nombres y los
--     turnos (shift_plans) pueden no tener teléfono vinculado.
--   - El filtrado real se aplica al LEER (cliente): quita de shift_plans y
--     rider_daily_stats a los riders dados de baja antes de calcular cumplimiento.
-- Mismo idiom RLS que el resto: is_org_member (lectura), org_role owner/admin,
-- escritura vía RPC SECURITY DEFINER. El navegador nunca escribe esta tabla.
-- =====================================================================

create table if not exists public.rider_exclusions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name_norm text not null,                 -- nombre normalizado (matchKey del cliente): clave de cruce sin teléfono
  rider_key text,                          -- teléfono normalizado si se pudo resolver la identidad
  display_name text,                       -- nombre tal cual (Excel / BD) para mostrar en la UI
  reason text,                             -- motivo opcional (p. ej. "despedido")
  active boolean not null default true,    -- true = oculto del cumplimiento; false = restaurado
  excluded_by uuid references auth.users(id) on delete set null,
  excluded_at timestamptz not null default now(),
  restored_by uuid references auth.users(id) on delete set null,
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_exclusions_org_idx on public.rider_exclusions(org_id);
create index if not exists rider_exclusions_org_active_idx on public.rider_exclusions(org_id, active);
-- Una baja por nombre normalizado y organización (permite upsert al re-dar de baja).
create unique index if not exists rider_exclusions_org_name_uk on public.rider_exclusions(org_id, name_norm);

alter table public.rider_exclusions enable row level security;
drop policy if exists rider_exclusions_select on public.rider_exclusions;
create policy rider_exclusions_select on public.rider_exclusions for select to authenticated using (public.is_org_member(org_id));

-- Rellena org_id por defecto en inserts (mismo patrón que shift_plans/rider_absences).
drop trigger if exists trg_org_id_rider_exclusions on public.rider_exclusions;
create trigger trg_org_id_rider_exclusions before insert on public.rider_exclusions
  for each row execute function public.set_org_id_default();

-- =====================================================================
-- RPC: da de baja a uno o varios riders. Upsert idempotente por name_norm.
-- p_riders: [{ name_norm, rider_key, display_name, reason }]
-- Reactiva (active=true) las bajas previas restauradas si se vuelven a subir.
-- =====================================================================
create or replace function public.exclude_riders(p_org uuid, p_riders jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then
    raise exception 'forbidden: solo owner/admin pueden dar de baja riders';
  end if;

  with rows as (
    select nullif(trim(x.name_norm), '') as name_norm,
           nullif(trim(x.rider_key), '') as rider_key,
           nullif(trim(x.display_name), '') as display_name,
           nullif(trim(x.reason), '') as reason
    from jsonb_to_recordset(coalesce(p_riders, '[]'::jsonb)) as x(
      name_norm text, rider_key text, display_name text, reason text)
    where nullif(trim(x.name_norm), '') is not null
  ),
  ins as (
    insert into public.rider_exclusions as e (org_id, name_norm, rider_key, display_name, reason, active, excluded_by, excluded_at, updated_at)
    select p_org, name_norm, rider_key, display_name, coalesce(reason, 'despedido'), true, auth.uid(), now(), now()
    from rows
    on conflict (org_id, name_norm) do update set
      rider_key = coalesce(excluded.rider_key, e.rider_key),
      display_name = coalesce(excluded.display_name, e.display_name),
      reason = coalesce(excluded.reason, e.reason),
      active = true,
      excluded_by = auth.uid(), excluded_at = now(),
      restored_by = null, restored_at = null, updated_at = now()
    returning 1
  )
  select count(*) into v_n from ins;

  return jsonb_build_object('excluded', v_n);
end $$;

-- =====================================================================
-- RPC: restaura (reactiva) a un rider dado de baja. Marca active=false en la
-- exclusión, con lo que vuelve a aparecer en el cumplimiento.
-- =====================================================================
create or replace function public.restore_rider(p_org uuid, p_name_norm text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then
    raise exception 'forbidden: solo owner/admin pueden restaurar riders';
  end if;

  update public.rider_exclusions
    set active = false, restored_by = auth.uid(), restored_at = now(), updated_at = now()
  where org_id = p_org and name_norm = p_name_norm and active = true;
  get diagnostics v_n = row_count;

  return jsonb_build_object('restored', v_n);
end $$;

-- Least-privilege.
revoke execute on function public.exclude_riders(uuid, jsonb) from public, anon;
revoke execute on function public.restore_rider(uuid, text) from public, anon;
grant execute on function public.exclude_riders(uuid, jsonb) to authenticated;
grant execute on function public.restore_rider(uuid, text) to authenticated;
