-- =====================================================================
-- HORARIOS Y CUMPLIMIENTO — Fase 0: fundación de datos.
-- Tablas org-scoped (multi-tenant) con el patrón RLS existente:
--   is_org_member(org_id) para lectura/escritura de miembros, y
--   org_role(org_id) in ('owner','admin') para escrituras sensibles.
-- La actividad real de los riders se captura periódicamente (cron) y se
-- compara contra los horarios subidos (CSV) para calcular el cumplimiento.
-- =====================================================================

-- ===== Roster: identidad estable del rider (clave = teléfono normalizado) =====
create table if not exists public.rider_roster (
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,                 -- teléfono normalizado (solo dígitos) o id de proveedor si no hay tel.
  provider text,                           -- 'uber' | 'glovo' (último proveedor visto)
  provider_rider_id text,
  name text,
  phone text,
  email text,
  vehicle_type text,
  active boolean not null default true,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (org_id, rider_key)
);
create index if not exists rider_roster_org_idx on public.rider_roster(org_id);

-- ===== Muestras de actividad (append-only, las escribe el cron de captura) =====
create table if not exists public.rider_activity_samples (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,
  provider text,
  captured_at timestamptz not null default now(),
  status text,                             -- estado interno: disponible|en_ruta|en_entrega|offline
  online boolean not null default false,
  on_trip boolean not null default false,
  lat double precision,
  lng double precision,
  active_deliveries int not null default 0
);
create index if not exists rider_samples_org_rider_time_idx
  on public.rider_activity_samples(org_id, rider_key, captured_at);
create index if not exists rider_samples_org_time_idx
  on public.rider_activity_samples(org_id, captured_at);

-- ===== Sesiones de trabajo derivadas (por rider y día) =====
create table if not exists public.rider_work_sessions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,
  work_date date not null,
  provider text,
  started_at timestamptz,                  -- primera muestra online del día
  ended_at timestamptz,                    -- última muestra online del día
  first_online_at timestamptz,
  last_online_at timestamptz,
  worked_minutes int not null default 0,   -- minutos online derivados (o horas del proveedor si las hay)
  trips int not null default 0,
  source text not null default 'samples',  -- 'samples' | 'provider'
  computed_at timestamptz not null default now(),
  primary key (org_id, rider_key, work_date)
);
create index if not exists rider_sessions_org_date_idx on public.rider_work_sessions(org_id, work_date);

-- ===== Horarios planificados (subidos por CSV) =====
create table if not exists public.rider_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,
  work_date date not null,
  planned_start timestamptz not null,
  planned_end timestamptz not null,
  planned_minutes int not null,
  source text not null default 'upload',
  batch_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, rider_key, work_date, planned_start)
);
create index if not exists rider_schedules_org_date_idx on public.rider_schedules(org_id, work_date);

-- ===== Auditoría de cada subida de horarios =====
create table if not exists public.schedule_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  filename text,
  rows_total int not null default 0,
  rows_ok int not null default 0,
  rows_failed int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists schedule_imports_org_idx on public.schedule_imports(org_id, created_at);

-- ===== Cumplimiento diario (una fila por rider/día; corazón del cálculo) =====
create table if not exists public.compliance_daily (
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,
  work_date date not null,
  planned_minutes int not null default 0,
  worked_minutes int not null default 0,
  check_in_delay_min int,                  -- + = entró tarde; - = entró antes; null = no asistió
  check_out_early_min int,                 -- + = salió antes
  attended boolean not null default false,
  late boolean not null default false,
  compliance_pct numeric not null default 0,
  status text not null default 'ausente',  -- cumple | tarde | incompleto | ausente
  computed_at timestamptz not null default now(),
  primary key (org_id, rider_key, work_date)
);
create index if not exists compliance_daily_org_date_idx on public.compliance_daily(org_id, work_date);

-- ===== Avisos de incumplimiento (en la app) =====
create table if not exists public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  rider_key text not null,
  work_date date not null,
  type text not null,                      -- ausencia | tarde | salida_anticipada | jornada_incompleta
  severity text not null default 'warning',
  message text,
  acknowledged boolean not null default false,
  acknowledged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, rider_key, work_date, type)
);
create index if not exists compliance_alerts_org_idx on public.compliance_alerts(org_id, acknowledged, created_at);

-- ===== Config de horarios por org (reutiliza org_settings) =====
alter table public.org_settings
  add column if not exists schedule_config jsonb not null default
    '{"timezone":"Europe/Madrid","grace_in_min":5,"grace_out_min":5,"min_compliance_pct":90,"week_starts_on":1}'::jsonb;

-- ===== RLS =====
alter table public.rider_roster            enable row level security;
alter table public.rider_activity_samples  enable row level security;
alter table public.rider_work_sessions     enable row level security;
alter table public.rider_schedules         enable row level security;
alter table public.schedule_imports        enable row level security;
alter table public.compliance_daily        enable row level security;
alter table public.compliance_alerts       enable row level security;

-- Lectura: cualquier miembro de la org. Escritura directa desde el navegador:
-- el cron/rollup usa service_role (salta RLS), así que las tablas que solo escribe
-- el backend NO necesitan policy de escritura para authenticated.
create policy rider_roster_select on public.rider_roster for select to authenticated using (public.is_org_member(org_id));
create policy rider_samples_select on public.rider_activity_samples for select to authenticated using (public.is_org_member(org_id));
create policy rider_sessions_select on public.rider_work_sessions for select to authenticated using (public.is_org_member(org_id));
create policy schedule_imports_select on public.schedule_imports for select to authenticated using (public.is_org_member(org_id));
create policy compliance_daily_select on public.compliance_daily for select to authenticated using (public.is_org_member(org_id));

-- Horarios: lectura miembros; escritura solo owner/admin (también vía RPC SECURITY DEFINER).
create policy rider_schedules_select on public.rider_schedules for select to authenticated using (public.is_org_member(org_id));
create policy rider_schedules_write on public.rider_schedules for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

-- Avisos: lectura miembros; update (marcar como visto) por miembros de la org.
create policy compliance_alerts_select on public.compliance_alerts for select to authenticated using (public.is_org_member(org_id));
create policy compliance_alerts_update on public.compliance_alerts for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- ===== Trigger org_id por defecto en las tablas escribibles desde el cliente =====
create trigger trg_org_id_rider_schedules before insert on public.rider_schedules
  for each row execute function public.set_org_id_default();

-- ===== Realtime: avisos en vivo =====
alter publication supabase_realtime add table public.compliance_alerts;
