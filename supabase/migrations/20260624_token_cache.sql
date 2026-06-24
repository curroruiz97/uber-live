-- Cache de tokens OAuth en org_secrets para evitar 429 de Uber.
alter table public.org_secrets
  add column if not exists uber_token text,
  add column if not exists uber_token_expires_at timestamptz;
