-- =====================================================================
-- FASE 1 — Branding por empresa + Storage + listado de equipo (aplicada vía MCP).
-- =====================================================================

-- Branding por organización
create table if not exists public.org_branding (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  company_name text,
  accent_light text not null default '249 115 22',
  accent_dark text not null default '251 146 60',
  logo_light_url text,
  logo_dark_url text,
  favicon_url text,
  updated_at timestamptz not null default now()
);
alter table public.org_branding enable row level security;
drop policy if exists org_branding_select on public.org_branding;
create policy org_branding_select on public.org_branding for select to authenticated using (public.is_org_member(org_id));
drop policy if exists org_branding_write on public.org_branding;
create policy org_branding_write on public.org_branding for all to authenticated
  using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

insert into public.org_branding(org_id, company_name)
  select id, name from public.organizations on conflict (org_id) do nothing;

-- create_organization: ahora también siembra branding (ver migración consolidada de Fase 0)
create or replace function public.create_organization(p_name text, p_slug text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_slug text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  v_slug := lower(regexp_replace(coalesce(nullif(p_slug,''), p_name, 'org'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(encode(gen_random_bytes(3),'hex'),1,6);
  end if;
  insert into public.organizations(name, slug, created_by) values (p_name, v_slug, auth.uid()) returning id into v_org;
  insert into public.org_members(org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.org_settings(org_id) values (v_org);
  insert into public.org_integrations(org_id) values (v_org);
  insert into public.org_branding(org_id, company_name) values (v_org, p_name);
  return v_org;
end $$;
revoke execute on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- Listado de miembros con email (sin abrir profiles)
create or replace function public.list_org_members(p_org uuid)
returns table(user_id uuid, email text, full_name text, role text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at
  from public.org_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org and public.is_org_member(p_org)
  order by m.created_at;
$$;
revoke execute on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;

-- Storage: bucket de branding (lectura pública, escritura owner/admin por carpeta org)
insert into storage.buckets (id, name, public) values ('org-branding','org-branding', true)
  on conflict (id) do nothing;
drop policy if exists org_branding_obj_read on storage.objects;
create policy org_branding_obj_read on storage.objects for select to public using (bucket_id = 'org-branding');
drop policy if exists org_branding_obj_insert on storage.objects;
create policy org_branding_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'org-branding' and public.org_role(((storage.foldername(name))[1])::uuid) in ('owner','admin'));
drop policy if exists org_branding_obj_update on storage.objects;
create policy org_branding_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'org-branding' and public.org_role(((storage.foldername(name))[1])::uuid) in ('owner','admin'));
drop policy if exists org_branding_obj_delete on storage.objects;
create policy org_branding_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'org-branding' and public.org_role(((storage.foldername(name))[1])::uuid) in ('owner','admin'));
