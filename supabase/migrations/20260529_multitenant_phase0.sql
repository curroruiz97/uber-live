-- =====================================================================
-- FASE 0 — Fundación multi-tenant (aplicada vía Supabase MCP).
-- Crea organizaciones/miembros/settings/integraciones/secretos, helpers RLS,
-- añade org_id a las tablas de datos, migra los datos de Sapiens y endurece RLS.
-- =====================================================================
create extension if not exists pgcrypto;

-- ===== Organizaciones (tenants) =====
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_idx on public.org_members(user_id);

create table if not exists public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  token text not null default encode(gen_random_bytes(24),'hex'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);
create index if not exists org_invitations_org_idx on public.org_invitations(org_id);
create index if not exists org_invitations_email_idx on public.org_invitations(lower(email));

-- ===== Helpers SECURITY DEFINER (sin RLS recursivo) =====
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.org_members m where m.org_id = p_org and m.user_id = auth.uid());
$$;
create or replace function public.org_role(p_org uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.org_members m where m.org_id = p_org and m.user_id = auth.uid();
$$;

-- ===== Settings / integraciones / secretos por org =====
create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  contact_message text,
  meta_phone_number_id text,
  meta_business_account_id text,
  mensatek_contacto text, mensatek_telcontacto text, mensatek_cifcontacto text,
  mensatek_sender_sms text, mensatek_sender_email text,
  mensatek_sms_text text, mensatek_email_subject text, mensatek_email_body text,
  onboarding_state jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.org_integrations (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  uber_configured boolean not null default false,
  uber_environment text not null default 'sandbox',
  uber_client_id text, uber_scope text, uber_last4 text,
  mensatek_configured boolean not null default false,
  mensatek_api_user text, mensatek_last4 text,
  whatsapp_status text,
  updated_at timestamptz not null default now()
);
-- SECRETOS: RLS habilitada SIN policies => bloqueado para el navegador (solo service_role).
create table if not exists public.org_secrets (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  uber_client_secret text,
  mensatek_api_token text,
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invitations enable row level security;
alter table public.org_settings enable row level security;
alter table public.org_integrations enable row level security;
alter table public.org_secrets enable row level security;

create policy organizations_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated using (public.org_role(id) in ('owner','admin')) with check (public.org_role(id) in ('owner','admin'));
create policy org_members_select on public.org_members for select to authenticated using (public.is_org_member(org_id));
create policy org_members_modify on public.org_members for all to authenticated using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));
create policy org_invitations_all on public.org_invitations for all to authenticated using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));
create policy org_settings_select on public.org_settings for select to authenticated using (public.is_org_member(org_id));
create policy org_settings_write on public.org_settings for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy org_integrations_select on public.org_integrations for select to authenticated using (public.is_org_member(org_id));
create policy org_integrations_write on public.org_integrations for all to authenticated using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

-- ===== RPC de alta de organización (autoservicio) =====
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
  return v_org;
end $$;

-- ===== org_id en las tablas de datos existentes =====
alter table public.wa_templates       add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.wa_sent_log        add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.mensatek_templates add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.mensatek_sent_log  add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- ===== Crear org Sapiens + miembros + settings + BACKFILL =====
do $$
declare v_org uuid; v_owner uuid;
begin
  select id into v_owner from auth.users where email = 'info@sapiens.tel' limit 1;
  select id into v_org from public.organizations where slug = 'sapiens-telco' limit 1;
  if v_org is null then
    insert into public.organizations(name, slug, created_by, is_platform_admin)
    values ('Sapiens Telco', 'sapiens-telco', v_owner, true) returning id into v_org;
  end if;
  insert into public.org_members(org_id, user_id, role)
    select v_org, u.id, case when u.email = 'info@sapiens.tel' then 'owner' else 'member' end
    from auth.users u on conflict (org_id, user_id) do nothing;
  insert into public.org_settings(org_id, contact_message, meta_phone_number_id, meta_business_account_id,
    mensatek_contacto, mensatek_telcontacto, mensatek_cifcontacto, mensatek_sender_sms, mensatek_sender_email,
    mensatek_sms_text, mensatek_email_subject, mensatek_email_body, updated_at)
    select v_org, a.contact_message, a.meta_phone_number_id, a.meta_business_account_id,
      a.mensatek_contacto, a.mensatek_telcontacto, a.mensatek_cifcontacto, a.mensatek_sender_sms, a.mensatek_sender_email,
      a.mensatek_sms_text, a.mensatek_email_subject, a.mensatek_email_body, now()
    from public.app_settings a where a.id = 1 on conflict (org_id) do nothing;
  insert into public.org_integrations(org_id) values (v_org) on conflict (org_id) do nothing;
  update public.wa_templates       set org_id = v_org where org_id is null;
  update public.wa_sent_log        set org_id = v_org where org_id is null;
  update public.mensatek_templates set org_id = v_org where org_id is null;
  update public.mensatek_sent_log  set org_id = v_org where org_id is null;
end $$;

-- ===== Trigger de seguridad: insert sin org_id usa la org del usuario =====
create or replace function public.set_org_id_default()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    select org_id into new.org_id from public.org_members where user_id = auth.uid() order by created_at limit 1;
  end if;
  return new;
end $$;
create trigger trg_org_id_wa_templates before insert on public.wa_templates for each row execute function public.set_org_id_default();
create trigger trg_org_id_wa_sent_log before insert on public.wa_sent_log for each row execute function public.set_org_id_default();
create trigger trg_org_id_mensatek_templates before insert on public.mensatek_templates for each row execute function public.set_org_id_default();
create trigger trg_org_id_mensatek_sent_log before insert on public.mensatek_sent_log for each row execute function public.set_org_id_default();

create index if not exists wa_templates_org_idx on public.wa_templates(org_id);
create index if not exists wa_sent_log_org_idx on public.wa_sent_log(org_id);
create index if not exists mensatek_templates_org_idx on public.mensatek_templates(org_id);
create index if not exists mensatek_sent_log_org_idx on public.mensatek_sent_log(org_id);

-- ===== Endurecer RLS por organización (reemplaza policies permisivas) =====
drop policy if exists wa_templates_all_auth on public.wa_templates;
create policy wa_templates_org on public.wa_templates for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists wa_sent_log_select_auth on public.wa_sent_log;
drop policy if exists wa_sent_log_insert_self on public.wa_sent_log;
create policy wa_sent_log_select on public.wa_sent_log for select to authenticated using (public.is_org_member(org_id));
create policy wa_sent_log_insert on public.wa_sent_log for insert to authenticated with check (public.is_org_member(org_id) and sent_by = auth.uid());
drop policy if exists mensatek_templates_all_auth on public.mensatek_templates;
create policy mensatek_templates_org on public.mensatek_templates for all to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists mensatek_sent_log_select_auth on public.mensatek_sent_log;
drop policy if exists mensatek_sent_log_insert_self on public.mensatek_sent_log;
create policy mensatek_sent_log_select on public.mensatek_sent_log for select to authenticated using (public.is_org_member(org_id));
create policy mensatek_sent_log_insert on public.mensatek_sent_log for insert to authenticated with check (public.is_org_member(org_id) and sent_by = auth.uid());

-- ===== Endurecer ejecución de funciones SECURITY DEFINER (quitar anon vía RPC) =====
revoke execute on function public.set_org_id_default() from public;
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.org_role(uuid) from public;
revoke execute on function public.create_organization(text, text) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.org_role(uuid) to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;
