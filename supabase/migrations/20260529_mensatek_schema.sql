-- Mensatek (SMS / Email Certificado) — esquema aplicado en Supabase.
-- Config en la fila única de app_settings + plantillas + log de envíos (RLS + Realtime).

-- Config de Mensatek en la fila única de app_settings (id=1)
alter table public.app_settings
  add column if not exists mensatek_contacto text,
  add column if not exists mensatek_telcontacto text,
  add column if not exists mensatek_cifcontacto text,
  add column if not exists mensatek_sender_sms text,
  add column if not exists mensatek_sender_email text,
  add column if not exists mensatek_email_subject text,
  add column if not exists mensatek_email_body text,
  add column if not exists mensatek_sms_text text;

-- Plantillas de Mensatek (SMS y Email)
create table if not exists public.mensatek_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'sms' check (channel in ('sms','email')),
  title text not null default 'Sin título',
  subject text not null default '',
  body text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mensatek_templates enable row level security;
drop policy if exists mensatek_templates_all_auth on public.mensatek_templates;
create policy mensatek_templates_all_auth on public.mensatek_templates
  for all to authenticated using (true) with check (true);

-- Log de envíos certificados (compartido por el equipo, en vivo)
create table if not exists public.mensatek_sent_log (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  rider_id text,
  rider_name text not null default '',
  channel text not null default 'sms',          -- sms | sms_contrato | email
  target text not null default '',               -- teléfono o email del rider
  subject text not null default '',
  message text not null default '',
  status text not null default 'enviado',
  id_mensaje text,
  cred numeric,
  creditos_usados integer,
  sent_by uuid references auth.users(id) on delete set null
);
alter table public.mensatek_sent_log enable row level security;
drop policy if exists mensatek_sent_log_select_auth on public.mensatek_sent_log;
create policy mensatek_sent_log_select_auth on public.mensatek_sent_log
  for select to authenticated using (true);
drop policy if exists mensatek_sent_log_insert_self on public.mensatek_sent_log;
create policy mensatek_sent_log_insert_self on public.mensatek_sent_log
  for insert to authenticated with check (sent_by = auth.uid());

create index if not exists mensatek_sent_log_ts_idx on public.mensatek_sent_log (ts desc);

-- Realtime para el log
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensatek_sent_log'
  ) then
    alter publication supabase_realtime add table public.mensatek_sent_log;
  end if;
end $$;
