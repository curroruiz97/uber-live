-- =====================================================================
-- HORARIOS — RPCs SECURITY DEFINER:
--   import_schedules: sube turnos (valida rol owner/admin), idempotente.
--   recompute_compliance: marca un rango para recálculo (lo procesa el rollup).
-- Mismo idiom que create_organization (valida rol, SET search_path, REVOKE/GRANT).
-- =====================================================================

-- Importa horarios desde un array jsonb de filas ya validadas en el cliente.
-- Cada fila: { rider_key, work_date, planned_start (ISO), planned_end (ISO), planned_minutes }
create or replace function public.import_schedules(p_org uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid := gen_random_uuid();
  v_total int := 0;
  v_ok int := 0;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then
    raise exception 'forbidden: solo owner/admin pueden subir horarios';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_total := v_total + 1;
    begin
      insert into public.rider_schedules(org_id, rider_key, work_date, planned_start, planned_end, planned_minutes, source, batch_id, created_by)
      values (
        p_org,
        r->>'rider_key',
        (r->>'work_date')::date,
        (r->>'planned_start')::timestamptz,
        (r->>'planned_end')::timestamptz,
        (r->>'planned_minutes')::int,
        'upload',
        v_batch,
        auth.uid()
      )
      on conflict (org_id, rider_key, work_date, planned_start)
      do update set planned_end = excluded.planned_end, planned_minutes = excluded.planned_minutes, batch_id = excluded.batch_id, created_by = excluded.created_by;
      v_ok := v_ok + 1;
    exception when others then
      -- fila inválida: se ignora y se cuenta como fallida.
      null;
    end;
  end loop;

  insert into public.schedule_imports(org_id, filename, rows_total, rows_ok, rows_failed, created_by)
  values (p_org, null, v_total, v_ok, v_total - v_ok, auth.uid());

  return jsonb_build_object('imported', v_ok, 'total', v_total, 'failed', v_total - v_ok, 'batch_id', v_batch);
end $$;

-- Solicita recálculo de un rango: borra el cumplimiento previo de ese rango para que el
-- rollup lo regenere en su próxima pasada (o se invoca el rollup directamente por HTTP).
create or replace function public.recompute_compliance(p_org uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deleted int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.org_role(p_org) not in ('owner','admin') then
    raise exception 'forbidden';
  end if;
  delete from public.compliance_daily where org_id = p_org and work_date between p_from and p_to;
  get diagnostics v_deleted = row_count;
  delete from public.compliance_alerts where org_id = p_org and work_date between p_from and p_to and acknowledged = false;
  return jsonb_build_object('cleared', v_deleted, 'from', p_from, 'to', p_to);
end $$;

-- Least-privilege: solo usuarios autenticados (el cuerpo exige owner/admin).
-- Supabase concede execute por defecto a anon/authenticated en funciones nuevas;
-- revocamos explícitamente a public Y a anon (revoke from public no quita el grant explícito a anon).
revoke execute on function public.import_schedules(uuid, jsonb) from public, anon;
revoke execute on function public.recompute_compliance(uuid, date, date) from public, anon;
grant execute on function public.import_schedules(uuid, jsonb) to authenticated;
grant execute on function public.recompute_compliance(uuid, date, date) to authenticated;
