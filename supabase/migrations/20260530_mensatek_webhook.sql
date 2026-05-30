-- Columna para el Código Seguro de Verificación (CSV) del certificado, que llega en
-- el webhook de reports de Mensatek. Permite descargar el PDF certificado más tarde.
alter table public.mensatek_sent_log add column if not exists csv text;
