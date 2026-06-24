-- Audit fixes: indexes, FK constraints, RLS, and is_unscheduled trigger.

-- 1. Fix mensatek_templates RLS: was overpermissive (using true → any user could see any org's templates)
drop policy if exists "mensatek_templates_org" on public.mensatek_templates;
create policy "mensatek_templates_select" on public.mensatek_templates
  for select to authenticated using (public.is_org_member(org_id));
create policy "mensatek_templates_write" on public.mensatek_templates
  for all to authenticated using (public.org_role(org_id) in ('owner','admin'))
  with check (public.org_role(org_id) in ('owner','admin'));

-- 2. Missing indexes for common query patterns
create index if not exists idx_rider_daily_stats_org_rider
  on public.rider_daily_stats (org_id, rider_key);
create index if not exists idx_shift_plans_org_rider_key
  on public.shift_plans (org_id, rider_key) where rider_key is not null;
create index if not exists idx_rider_absences_org_rider_key
  on public.rider_absences (org_id, rider_key) where rider_key is not null;
create index if not exists idx_rider_name_links_org_provider
  on public.rider_name_links (org_id, provider);

-- 3. FK constraints on shift_plans and rider_absences (cascade on org delete)
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'shift_plans_org_id_fkey' and table_name = 'shift_plans'
  ) then
    alter table public.shift_plans
      add constraint shift_plans_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'rider_absences_org_id_fkey' and table_name = 'rider_absences'
  ) then
    alter table public.rider_absences
      add constraint rider_absences_org_id_fkey
      foreign key (org_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

-- 4. Trigger: recompute is_unscheduled in rider_daily_stats when shift_plans.rider_key changes
create or replace function public.refresh_unscheduled_flag()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rider_key text;
begin
  v_rider_key := coalesce(new.rider_key, old.rider_key);
  if v_rider_key is null then return coalesce(new, old); end if;

  update rider_daily_stats rds
  set is_unscheduled = not exists (
    select 1 from shift_plans sp
    where sp.org_id = rds.org_id and sp.rider_key = rds.rider_key
  )
  where rds.org_id = coalesce(new.org_id, old.org_id)
    and rds.rider_key = v_rider_key;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_shift_plans_unscheduled on public.shift_plans;
create trigger trg_shift_plans_unscheduled
  after insert or update of rider_key or delete on public.shift_plans
  for each row execute function public.refresh_unscheduled_flag();

-- 5. Validate rider_absences: ensure fecha_fin >= fecha_inicio
alter table public.rider_absences
  drop constraint if exists chk_absence_dates;
alter table public.rider_absences
  add constraint chk_absence_dates
  check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio);
