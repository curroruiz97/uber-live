-- Glovo (Live Operations API) por organización.
-- La clave privada RSA con la que se firma el client_assertion JWT es un SECRETO ->
-- org_secrets (RLS sin políticas para authenticated: solo la lee la service_role dentro
-- de la Edge Function `glovo`; nunca llega al navegador). El client_id, kid, company_id,
-- city_codes y el estado visible van a org_integrations (no secreto), igual que Uber.
alter table public.org_secrets
  add column if not exists glovo_private_key text;

alter table public.org_integrations
  add column if not exists glovo_configured boolean not null default false,
  add column if not exists glovo_client_id text,
  add column if not exists glovo_kid text,
  add column if not exists glovo_company_id text,
  add column if not exists glovo_city_codes text,   -- CSV: "BCN:12,MAD:7" (code:cityId) o "12,7"
  add column if not exists glovo_environment text default 'staging',
  add column if not exists glovo_last4 text;
