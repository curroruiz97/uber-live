-- =====================================================================
-- HORARIOS por rider: turnos semanales (shift_plans) + estados/ausencias
-- (rider_absences) con duración y previsión de días no trabajables.
-- Multi-tenant: org_id + RLS (is_org_member para leer, org_role owner/admin
-- para escribir) + trigger de org_id por defecto. Datos importados de los
-- PDFs de Uber por ciudad; el teléfono se cruza con rider_roster cuando exista.
-- =====================================================================

-- ===== Turnos semanales por rider =====
create table if not exists public.shift_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null default 'uber',
  city text,
  rider_name text not null,
  rider_phone text,
  rider_key text,
  dia text not null check (dia in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  turno text not null check (turno in ('manana','tarde')),
  hora_inicio text not null,
  hora_fin text not null,
  notas text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shift_plans_org_idx on public.shift_plans(org_id, provider, city);
create index if not exists shift_plans_org_rider_idx on public.shift_plans(org_id, rider_name);

alter table public.shift_plans enable row level security;
drop policy if exists shift_plans_select on public.shift_plans;
create policy shift_plans_select on public.shift_plans for select to authenticated using (public.is_org_member(org_id));
drop policy if exists shift_plans_write on public.shift_plans;
create policy shift_plans_write on public.shift_plans for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

drop trigger if exists trg_org_id_shift_plans on public.shift_plans;
create trigger trg_org_id_shift_plans before insert on public.shift_plans
  for each row execute function public.set_org_id_default();

-- ===== Estados / ausencias por rider =====
create table if not exists public.rider_absences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  provider text not null default 'uber',
  city text,
  rider_name text not null,
  rider_phone text,
  rider_key text,
  tipo text not null check (tipo in ('baja_laboral','vacaciones','permiso_no_retribuido','medico','asuntos_propios','averia_vehiculo')),
  fecha_inicio date,
  dias int,
  fecha_fin date,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rider_absences_org_idx on public.rider_absences(org_id, provider, city);
create index if not exists rider_absences_org_rider_idx on public.rider_absences(org_id, rider_name);

alter table public.rider_absences enable row level security;
drop policy if exists rider_absences_select on public.rider_absences;
create policy rider_absences_select on public.rider_absences for select to authenticated using (public.is_org_member(org_id));
drop policy if exists rider_absences_write on public.rider_absences;
create policy rider_absences_write on public.rider_absences for all to authenticated
  using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

drop trigger if exists trg_org_id_rider_absences on public.rider_absences;
create trigger trg_org_id_rider_absences before insert on public.rider_absences
  for each row execute function public.set_org_id_default();
