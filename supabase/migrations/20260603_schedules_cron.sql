-- =====================================================================
-- HORARIOS — Programación del cron (pg_cron + pg_net), auto-contenida.
-- Crea cron_config (secreto + URL base de Edge Functions, RLS bloquea al navegador)
-- y programa schedule-capture (cada 10 min), schedule-rollup (diario) y la purga.
-- Las Edge Functions validan el secreto leyendo cron_config con service_role.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ===== Config del cron (una sola fila) =====
create table if not exists public.cron_config (
  id int primary key default 1,
  secret text not null,
  edge_base text not null,
  updated_at timestamptz not null default now(),
  constraint cron_config_singleton check (id = 1)
);
alter table public.cron_config enable row level security;
-- Sin policies para authenticated: solo service_role (Edge Functions) lo lee. Igual que org_secrets.

-- Inserta secreto + URL base (idempotente; el secreto se genera la primera vez).
insert into public.cron_config (id, secret, edge_base)
values (1, encode(gen_random_bytes(24), 'hex'), 'https://xudjolvrizxkwzusoljy.functions.supabase.co')
on conflict (id) do update set edge_base = excluded.edge_base, updated_at = now();

-- ===== Jobs =====
do $$ begin perform cron.unschedule('schedule-capture'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('schedule-rollup'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('schedule-purge-samples'); exception when others then null; end $$;

-- Captura cada 10 minutos (lee secreto/URL de cron_config en el momento de ejecutar).
select cron.schedule('schedule-capture', '*/10 * * * *', $job$
  select net.http_post(
    url := (select edge_base from public.cron_config where id = 1) || '/schedule-capture',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select secret from public.cron_config where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);

-- Rollup diario 03:10 UTC.
select cron.schedule('schedule-rollup', '10 3 * * *', $job$
  select net.http_post(
    url := (select edge_base from public.cron_config where id = 1) || '/schedule-rollup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select secret from public.cron_config where id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$job$);

-- Retención: purga muestras > 90 días (04:30 UTC).
select cron.schedule('schedule-purge-samples', '30 4 * * *', $job$
  delete from public.rider_activity_samples where captured_at < now() - interval '90 days';
$job$);
