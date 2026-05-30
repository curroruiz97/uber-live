-- WhatsApp Cloud API (oficial de Meta / "WhatsApp Business API") por organización.
-- El token permanente de Meta es un SECRETO -> org_secrets (RLS sin políticas para
-- authenticated: solo lo lee la service_role dentro de las Edge Functions; nunca el
-- navegador). El phone_number_id / business_account_id y el estado visible van a
-- org_integrations (no secreto), igual que Uber y Mensatek.
alter table public.org_secrets
  add column if not exists whatsapp_token text;

alter table public.org_integrations
  add column if not exists whatsapp_phone_number_id text,
  add column if not exists whatsapp_business_account_id text,
  add column if not exists whatsapp_configured boolean not null default false,
  add column if not exists whatsapp_last4 text,
  add column if not exists whatsapp_verified_name text,
  add column if not exists whatsapp_display_phone text;
