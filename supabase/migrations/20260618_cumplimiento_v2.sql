-- =====================================================================
-- CUMPLIMIENTO v2 — actividad diaria real (CSV COURIER_DAILY) × turnos
-- planificados (shift_plans/rider_absences). Sustituye la cadena de captura
-- por cron (vacía) por una importación de CSV diaria + histórico.
--   - rider_daily_stats: una fila por (org, rider_key=teléfono, día), métricas
--     SUMADAS por mercado; latest-export-wins entre ficheros.
--   - glovo_imports: auditoría de cada subida.
--   - rider_name_links: mapeo persistente nombre→identidad (teléfono) para cruzar
--     los turnos (sin teléfono) con la actividad (con teléfono). Propaga por
--     coincidencia EXACTA de rider_name (sin riesgo de paridad de normalización).
-- Mismo idiom RLS que el resto: is_org_member (lectura), org_role owner/admin y
-- RPCs SECURITY DEFINER (escritura). El navegador nunca escribe estas tablas.
-- =====================================================================

-- ===== Actividad diaria real =====
create table if not exists public.rider_daily_stats (
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,                 -- teléfono normalizado (solo dígitos)
  work_date date not null,                 -- datestr del CSV (día de actividad)
  -- identidad (denormalizada para mostrar)
  driver_uuid text,
  driver_name text,
  driver_email text,
  driver_phone text,
  city text,
  city_id text,
  form_factor text,
  markets text[] not null default '{}',
  -- horas (sumadas por mercado)
  online_hours numeric(10,4) not null default 0,
  active_hours numeric(10,4) not null default 0,
  open_hours numeric(10,4) not null default 0,
  enroute_p2_hours numeric(10,4) not null default 0,
  ontrip_p3_hours numeric(10,4) not null default 0,
  unavailable_hours numeric(10,4) not null default 0,
  -- viajes / calidad (sumados)
  num_of_trips int not null default 0,
  single_trips_total int not null default 0,
  late_p2_trips int not null default 0,
  late_p3_trips int not null default 0,
  accept_trips int not null default 0,
  reject_trips int not null default 0,
  cancel_trips int not null default 0,
  cancel_not_at_fault_trips int not null default 0,
  -- distancia / tiempo (sumados; los *_avg se derivan al leer, no se guardan)
  p2_km numeric(12,3) not null default 0,
  p2_min numeric(12,3) not null default 0,
  p3_km numeric(12,3) not null default 0,
  p3_min numeric(12,3) not null default 0,
  total_km numeric(12,3) not null default 0,
  total_min numeric(12,3) not null default 0,
  -- procedencia / idempotencia
  source_provider text not null default 'glovo',
  source_exported_at timestamptz not null,
  source_filename text,
  is_unscheduled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, rider_key, work_date)
);
create index if not exists rider_daily_stats_org_date_idx on public.rider_daily_stats(org_id, work_date);
create index if not exists rider_daily_stats_org_uuid_idx on public.rider_daily_stats(org_id, driver_uuid);

-- ===== Auditoría de importaciones =====
create table if not exists public.glovo_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  filename text,
  exported_at timestamptz,
  rows_in int not null default 0,
  rows_upserted int not null default 0,
  rows_skipped_older int not null default 0,
  new_riders int not null default 0,
  date_min date,
  date_max date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists glovo_imports_org_idx on public.glovo_imports(org_id, created_at desc);

-- ===== Mapeo de identidad: nombre del turno -> rider_key (teléfono) =====
create table if not exists public.rider_name_links (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'uber',
  rider_name text not null,                -- nombre EXACTO tal cual está en shift_plans
  name_norm text,                          -- normalizado (referencia/UI), lo calcula el cliente
  rider_key text not null,
  rider_phone text,
  method text not null default 'manual',   -- 'manual' | 'auto_exact' | 'auto_token'
  confidence numeric,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, provider, rider_name)
);
create index if not exists rider_name_links_org_key_idx on public.rider_name_links(org_id, rider_key);

-- ===== RLS (solo lectura para authenticated; escritura vía RPC SECURITY DEFINER) =====
alter table public.rider_daily_stats enable row level security;
alter table public.glovo_imports     enable row level security;
alter table public.rider_name_links  enable row level security;

drop policy if exists rider_daily_stats_select on public.rider_daily_stats;
create policy rider_daily_stats_select on public.rider_daily_stats for select to authenticated using (public.is_org_member(org_id));
drop policy if exists glovo_imports_select on public.glovo_imports;
create policy glovo_imports_select on public.glovo_imports for select to authenticated using (public.is_org_member(org_id));
drop policy if exists rider_name_links_select on public.rider_name_links;
create policy rider_name_links_select on public.rider_name_links for select to authenticated using (public.is_org_member(org_id));

-- ===== Config: añade claves nuevas a schedule_config sin pisar las existentes =====
update public.org_settings
  set schedule_config = '{"hours_metric":"active","min_compliance_pct":100,"presence_threshold_hours":0.5,"target_acceptance_pct":90,"max_cancel_pct":5}'::jsonb || coalesce(schedule_config, '{}'::jsonb)
  where schedule_config is null or not (schedule_config ? 'hours_metric');

-- =====================================================================
-- RPC: importa actividad diaria. El cliente ya agregó por (teléfono,día)
-- sumando mercados. Upsert idempotente con latest-export-wins (no pisa una
-- fila escrita por una exportación más reciente). Acepta source_exported_at
-- por fila (histórico consolidado) con fallback a p_exported_at (subida diaria).
-- =====================================================================
create or replace function public.import_glovo_daily(
  p_org uuid, p_rows jsonb, p_exported_at timestamptz default null, p_filename text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_in int := 0; v_ins int := 0; v_upd int := 0; v_new int := 0;
  v_dmin date; v_dmax date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then
    raise exception 'forbidden: solo owner/admin pueden importar actividad';
  end if;

  -- Recuento de entrada (filas válidas) y rango de fechas.
  select count(*), min(work_date), max(work_date) into v_in, v_dmin, v_dmax
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(rider_key text, work_date date)
  where x.rider_key is not null and x.rider_key <> '' and x.work_date is not null;

  -- Upsert principal con latest-export-wins.
  with incoming as (
    select
      x.rider_key, x.work_date, x.driver_uuid, x.driver_name, x.driver_email, x.driver_phone,
      x.city, x.city_id, x.form_factor, coalesce(x.markets, '{}') as markets,
      coalesce(x.online_hours,0) online_hours, coalesce(x.active_hours,0) active_hours,
      coalesce(x.open_hours,0) open_hours, coalesce(x.enroute_p2_hours,0) enroute_p2_hours,
      coalesce(x.ontrip_p3_hours,0) ontrip_p3_hours, coalesce(x.unavailable_hours,0) unavailable_hours,
      coalesce(x.num_of_trips,0) num_of_trips, coalesce(x.single_trips_total,0) single_trips_total,
      coalesce(x.late_p2_trips,0) late_p2_trips, coalesce(x.late_p3_trips,0) late_p3_trips,
      coalesce(x.accept_trips,0) accept_trips, coalesce(x.reject_trips,0) reject_trips,
      coalesce(x.cancel_trips,0) cancel_trips, coalesce(x.cancel_not_at_fault_trips,0) cancel_not_at_fault_trips,
      coalesce(x.p2_km,0) p2_km, coalesce(x.p2_min,0) p2_min, coalesce(x.p3_km,0) p3_km,
      coalesce(x.p3_min,0) p3_min, coalesce(x.total_km,0) total_km, coalesce(x.total_min,0) total_min,
      coalesce(x.source_exported_at, p_exported_at, now()) as source_exported_at
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      rider_key text, work_date date, driver_uuid text, driver_name text, driver_email text,
      driver_phone text, city text, city_id text, form_factor text, markets text[],
      online_hours numeric, active_hours numeric, open_hours numeric, enroute_p2_hours numeric,
      ontrip_p3_hours numeric, unavailable_hours numeric,
      num_of_trips numeric, single_trips_total numeric, late_p2_trips numeric, late_p3_trips numeric,
      accept_trips numeric, reject_trips numeric, cancel_trips numeric, cancel_not_at_fault_trips numeric,
      p2_km numeric, p2_min numeric, p3_km numeric, p3_min numeric, total_km numeric, total_min numeric,
      source_exported_at timestamptz
    )
    where x.rider_key is not null and x.rider_key <> '' and x.work_date is not null
  ),
  up as (
    insert into public.rider_daily_stats as t (
      org_id, rider_key, work_date, driver_uuid, driver_name, driver_email, driver_phone,
      city, city_id, form_factor, markets,
      online_hours, active_hours, open_hours, enroute_p2_hours, ontrip_p3_hours, unavailable_hours,
      num_of_trips, single_trips_total, late_p2_trips, late_p3_trips, accept_trips, reject_trips,
      cancel_trips, cancel_not_at_fault_trips, p2_km, p2_min, p3_km, p3_min, total_km, total_min,
      source_provider, source_exported_at, source_filename, is_unscheduled
    )
    select p_org, i.rider_key, i.work_date, i.driver_uuid, i.driver_name, i.driver_email, i.driver_phone,
      i.city, i.city_id, i.form_factor, i.markets,
      i.online_hours, i.active_hours, i.open_hours, i.enroute_p2_hours, i.ontrip_p3_hours, i.unavailable_hours,
      i.num_of_trips, i.single_trips_total, i.late_p2_trips, i.late_p3_trips, i.accept_trips, i.reject_trips,
      i.cancel_trips, i.cancel_not_at_fault_trips, i.p2_km, i.p2_min, i.p3_km, i.p3_min, i.total_km, i.total_min,
      'glovo', i.source_exported_at, p_filename,
      not exists (select 1 from public.shift_plans s where s.org_id = p_org and s.rider_key = i.rider_key)
    from incoming i
    on conflict (org_id, rider_key, work_date) do update set
      driver_uuid = excluded.driver_uuid, driver_name = excluded.driver_name, driver_email = excluded.driver_email,
      driver_phone = excluded.driver_phone, city = excluded.city, city_id = excluded.city_id,
      form_factor = excluded.form_factor, markets = excluded.markets,
      online_hours = excluded.online_hours, active_hours = excluded.active_hours, open_hours = excluded.open_hours,
      enroute_p2_hours = excluded.enroute_p2_hours, ontrip_p3_hours = excluded.ontrip_p3_hours,
      unavailable_hours = excluded.unavailable_hours, num_of_trips = excluded.num_of_trips,
      single_trips_total = excluded.single_trips_total, late_p2_trips = excluded.late_p2_trips,
      late_p3_trips = excluded.late_p3_trips, accept_trips = excluded.accept_trips, reject_trips = excluded.reject_trips,
      cancel_trips = excluded.cancel_trips, cancel_not_at_fault_trips = excluded.cancel_not_at_fault_trips,
      p2_km = excluded.p2_km, p2_min = excluded.p2_min, p3_km = excluded.p3_km, p3_min = excluded.p3_min,
      total_km = excluded.total_km, total_min = excluded.total_min,
      source_exported_at = excluded.source_exported_at, source_filename = excluded.source_filename,
      is_unscheduled = excluded.is_unscheduled, updated_at = now()
    where excluded.source_exported_at >= t.source_exported_at
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted) into v_ins, v_upd from up;

  -- Upsert del roster desde las identidades de la actividad (teléfono es la clave).
  with ros as (
    select distinct on (x.rider_key) x.rider_key, x.driver_uuid, x.driver_name, x.driver_phone,
           x.driver_email, x.form_factor
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      rider_key text, work_date date, driver_uuid text, driver_name text, driver_phone text,
      driver_email text, form_factor text)
    where x.rider_key is not null and x.rider_key <> ''
    order by x.rider_key, x.work_date desc nulls last
  ),
  rup as (
    insert into public.rider_roster as r (org_id, rider_key, provider, provider_rider_id, name, phone, email, vehicle_type, last_seen)
    select p_org, rider_key, 'glovo', driver_uuid, driver_name, driver_phone, driver_email, form_factor, now()
    from ros
    on conflict (org_id, rider_key) do update set
      provider = 'glovo',
      provider_rider_id = coalesce(excluded.provider_rider_id, r.provider_rider_id),
      name = coalesce(excluded.name, r.name),
      phone = coalesce(excluded.phone, r.phone),
      email = coalesce(excluded.email, r.email),
      vehicle_type = coalesce(excluded.vehicle_type, r.vehicle_type),
      last_seen = now()
    returning (xmax = 0) as inserted
  )
  select count(*) filter (where inserted) into v_new from rup;

  insert into public.glovo_imports(org_id, filename, exported_at, rows_in, rows_upserted, rows_skipped_older, new_riders, date_min, date_max, created_by)
  values (p_org, p_filename, p_exported_at, v_in, v_ins + v_upd, v_in - (v_ins + v_upd), v_new, v_dmin, v_dmax, auth.uid());

  return jsonb_build_object(
    'rows_in', v_in, 'rows_upserted', v_ins + v_upd, 'rows_inserted', v_ins, 'rows_updated', v_upd,
    'rows_skipped_older', v_in - (v_ins + v_upd), 'new_riders', v_new, 'date_min', v_dmin, 'date_max', v_dmax
  );
end $$;

-- =====================================================================
-- RPC: vincula nombres de turno con identidades (teléfono). Upsert del mapeo
-- y propagación por coincidencia EXACTA de rider_name a shift_plans/rider_absences.
-- No deja que un auto-match pise un enlace manual.
-- p_pairs: [{ provider, rider_name, name_norm, rider_key, rider_phone, method, confidence }]
-- =====================================================================
create or replace function public.link_riders(p_org uuid, p_pairs jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_links int := 0; v_sp int := 0; v_ab int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then raise exception 'forbidden'; end if;

  with pairs as (
    select coalesce(x.provider,'uber') provider, x.rider_name, x.name_norm, x.rider_key,
           x.rider_phone, coalesce(x.method,'manual') method, x.confidence
    from jsonb_to_recordset(coalesce(p_pairs, '[]'::jsonb)) as x(
      provider text, rider_name text, name_norm text, rider_key text, rider_phone text,
      method text, confidence numeric)
    where x.rider_name is not null and x.rider_key is not null and x.rider_key <> ''
  ),
  ins as (
    insert into public.rider_name_links as l (org_id, provider, rider_name, name_norm, rider_key, rider_phone, method, confidence, linked_by, updated_at)
    select p_org, provider, rider_name, name_norm, rider_key, rider_phone, method, confidence, auth.uid(), now()
    from pairs
    on conflict (org_id, provider, rider_name) do update set
      name_norm = excluded.name_norm, rider_key = excluded.rider_key, rider_phone = excluded.rider_phone,
      method = excluded.method, confidence = excluded.confidence, linked_by = excluded.linked_by, updated_at = now()
    -- un auto-match NO pisa un enlace manual previo
    where l.method <> 'manual' or excluded.method = 'manual'
    returning 1
  )
  select count(*) into v_links from ins;

  -- Propaga el cache de identidad a los turnos y ausencias (match exacto por nombre).
  update public.shift_plans s
    set rider_key = l.rider_key, rider_phone = l.rider_phone, updated_at = now()
  from public.rider_name_links l
  where s.org_id = p_org and l.org_id = p_org and l.provider = s.provider
    and s.rider_name = l.rider_name and s.rider_key is distinct from l.rider_key;
  get diagnostics v_sp = row_count;

  update public.rider_absences a
    set rider_key = l.rider_key, rider_phone = l.rider_phone, updated_at = now()
  from public.rider_name_links l
  where a.org_id = p_org and l.org_id = p_org and l.provider = a.provider
    and a.rider_name = l.rider_name and a.rider_key is distinct from l.rider_key;
  get diagnostics v_ab = row_count;

  return jsonb_build_object('links_upserted', v_links, 'shift_plans_updated', v_sp, 'absences_updated', v_ab);
end $$;

-- Re-propaga todos los enlaces (llamar tras reimportar horarios).
create or replace function public.apply_rider_links(p_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sp int := 0; v_ab int := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then raise exception 'forbidden'; end if;

  update public.shift_plans s
    set rider_key = l.rider_key, rider_phone = l.rider_phone, updated_at = now()
  from public.rider_name_links l
  where s.org_id = p_org and l.org_id = p_org and l.provider = s.provider
    and s.rider_name = l.rider_name and s.rider_key is distinct from l.rider_key;
  get diagnostics v_sp = row_count;

  update public.rider_absences a
    set rider_key = l.rider_key, rider_phone = l.rider_phone, updated_at = now()
  from public.rider_name_links l
  where a.org_id = p_org and l.org_id = p_org and l.provider = a.provider
    and a.rider_name = l.rider_name and a.rider_key is distinct from l.rider_key;
  get diagnostics v_ab = row_count;

  return jsonb_build_object('shift_plans_updated', v_sp, 'absences_updated', v_ab);
end $$;

-- Least-privilege.
revoke execute on function public.import_glovo_daily(uuid, jsonb, timestamptz, text) from public, anon;
revoke execute on function public.link_riders(uuid, jsonb) from public, anon;
revoke execute on function public.apply_rider_links(uuid) from public, anon;
grant execute on function public.import_glovo_daily(uuid, jsonb, timestamptz, text) to authenticated;
grant execute on function public.link_riders(uuid, jsonb) to authenticated;
grant execute on function public.apply_rider_links(uuid) to authenticated;

-- ===== Desprograma los crons muertos (la captura en vivo no producía datos). =====
do $$ begin perform cron.unschedule('schedule-capture');       exception when others then null; end $$;
do $$ begin perform cron.unschedule('schedule-rollup');        exception when others then null; end $$;
do $$ begin perform cron.unschedule('schedule-purge-samples'); exception when others then null; end $$;
