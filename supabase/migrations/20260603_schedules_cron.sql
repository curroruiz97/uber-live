-- =====================================================================
-- HORARIOS — Programación del cron (pg_cron + pg_net).
-- Invoca las Edge Functions schedule-capture (cada 10 min) y schedule-rollup
-- (1×/día de madrugada, hora España) vía HTTP con el secreto de cron.
--
-- IMPORTANTE — antes de ejecutar, define estos dos settings en el proyecto
-- (Dashboard → Database → Settings, o por SQL una sola vez como superuser):
--   select set_config('app.edge_base', 'https://xudjolvrizxkwzusoljy.functions.supabase.co', false);
--   select set_config('app.cron_secret', '<EL_MISMO_VALOR_que_CRON_SECRET_en_las_functions>', false);
-- O sustituye directamente las dos constantes de abajo por sus valores literales.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpia jobs previos con el mismo nombre (idempotente al re-aplicar).
do $$
begin
  perform cron.unschedule('schedule-capture');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('schedule-rollup');
exception when others then null;
end $$;

-- Captura cada 10 minutos.
select cron.schedule(
  'schedule-capture',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.edge_base', true) || '/schedule-capture',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Rollup diario a las 03:10 UTC (~05:10 hora peninsular en verano / 04:10 en invierno).
select cron.schedule(
  'schedule-rollup',
  '10 3 * * *',
  $$
  select net.http_post(
    url := current_setting('app.edge_base', true) || '/schedule-rollup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

-- Retención: purga muestras de actividad > 90 días (mantener el volumen a raya).
do $$
begin
  perform cron.unschedule('schedule-purge-samples');
exception when others then null;
end $$;
select cron.schedule(
  'schedule-purge-samples',
  '30 4 * * *',
  $$ delete from public.rider_activity_samples where captured_at < now() - interval '90 days'; $$
);
