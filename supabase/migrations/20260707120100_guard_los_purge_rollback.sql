-- AUDIT #477 (CRITICAL): purge_absent_los_members()/rollback_los_import() had no
-- auth guard and were EXECUTE-granted to anon/authenticated, allowing anonymous
-- destruction/corruption of the entire LOS dataset. Add the standard guard and
-- restrict EXECUTE to service_role (both real call sites already use the
-- service-role client with app-layer requireAdmin() checks).
CREATE OR REPLACE FUNCTION public.purge_absent_los_members(p_keep_abos text[], p_imported_by uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_removed   integer := 0;
  v_snapshot  jsonb;
  v_import_id uuid    := gen_random_uuid();
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Snapshot current state before deletion
  SELECT jsonb_agg(row_to_json(lm)::jsonb)
    INTO v_snapshot
    FROM public.los_members lm;
  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  -- Delete everything not in the keep set
  DELETE FROM public.los_members
  WHERE abo_number != ALL(p_keep_abos);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Rebuild tree paths
  PERFORM public.rebuild_tree_paths();

  -- Record purge (rollback_los_import accepts any status != 'rolled_back')
  INSERT INTO public.los_imports (id, imported_by, status, row_count, removed_count, snapshot)
  VALUES (v_import_id, p_imported_by, 'purge', 0, v_removed, v_snapshot);

  RETURN jsonb_build_object(
    'removed',   v_removed,
    'import_id', v_import_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_los_import(p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_snapshot      jsonb;
  v_snap_row      jsonb;
  v_entry_date    date;
  v_renewal_date  date;
  v_snap_abos     text[];
  v_restored      integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- ── Fetch snapshot ─────────────────────────────────────────────────────────
  SELECT snapshot INTO v_snapshot
  FROM public.los_imports
  WHERE id = p_import_id AND status != 'rolled_back';

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Import % not found or already rolled back', p_import_id;
  END IF;

  -- ── Build ABO set from snapshot ────────────────────────────────────────────
  SELECT ARRAY(
    SELECT elem->>'abo_number'
    FROM jsonb_array_elements(v_snapshot) AS elem
    WHERE nullif(elem->>'abo_number', '') IS NOT NULL
  ) INTO v_snap_abos;

  -- ── Truncate and restore from snapshot ────────────────────────────────────
  -- Delete any ABO not in snapshot first, then upsert snapshot rows
  DELETE FROM public.los_members
  WHERE abo_number != ALL(v_snap_abos);

  FOR v_snap_row IN SELECT * FROM jsonb_array_elements(v_snapshot)
  LOOP
    v_entry_date := CASE
      WHEN nullif(v_snap_row->>'entry_date', '') IS NULL THEN NULL
      WHEN v_snap_row->>'entry_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (v_snap_row->>'entry_date')::date
      ELSE NULL
    END;

    v_renewal_date := CASE
      WHEN nullif(v_snap_row->>'renewal_date', '') IS NULL THEN NULL
      WHEN v_snap_row->>'renewal_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (v_snap_row->>'renewal_date')::date
      ELSE NULL
    END;

    INSERT INTO public.los_members (
      abo_number, sponsor_abo_number, abo_level, country, name,
      entry_date, phone, email, address, renewal_date,
      gpv, ppv, bonus_percent, gbv, customer_pv, ruby_pv,
      customers, points_to_next_level, qualified_legs, group_size,
      personal_order_count, group_orders_count, sponsoring,
      annual_ppv, last_synced_at
    ) VALUES (
      v_snap_row->>'abo_number',
      nullif(v_snap_row->>'sponsor_abo_number', ''),
      v_snap_row->>'abo_level',
      v_snap_row->>'country',
      v_snap_row->>'name',
      v_entry_date,
      v_snap_row->>'phone',
      v_snap_row->>'email',
      v_snap_row->>'address',
      v_renewal_date,
      COALESCE(nullif(v_snap_row->>'gpv',                  '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'ppv',                  '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'bonus_percent',         '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'gbv',                  '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'customer_pv',           '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'ruby_pv',              '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'customers',             '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'points_to_next_level',  '')::numeric, 0),
      COALESCE(nullif(v_snap_row->>'qualified_legs',        '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'group_size',            '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'personal_order_count',  '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'group_orders_count',    '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'sponsoring',            '')::integer, 0),
      COALESCE(nullif(v_snap_row->>'annual_ppv',            '')::numeric, 0),
      now()
    )
    ON CONFLICT (abo_number) DO UPDATE SET
      sponsor_abo_number   = excluded.sponsor_abo_number,
      abo_level            = excluded.abo_level,
      country              = excluded.country,
      name                 = excluded.name,
      entry_date           = excluded.entry_date,
      phone                = excluded.phone,
      email                = excluded.email,
      address              = excluded.address,
      renewal_date         = excluded.renewal_date,
      gpv                  = excluded.gpv,
      ppv                  = excluded.ppv,
      bonus_percent        = excluded.bonus_percent,
      gbv                  = excluded.gbv,
      customer_pv          = excluded.customer_pv,
      ruby_pv              = excluded.ruby_pv,
      customers            = excluded.customers,
      points_to_next_level = excluded.points_to_next_level,
      qualified_legs       = excluded.qualified_legs,
      group_size           = excluded.group_size,
      personal_order_count = excluded.personal_order_count,
      group_orders_count   = excluded.group_orders_count,
      sponsoring           = excluded.sponsoring,
      annual_ppv           = excluded.annual_ppv,
      last_synced_at       = now();

    v_restored := v_restored + 1;
  END LOOP;

  -- ── Rebuild tree paths ─────────────────────────────────────────────────────
  PERFORM public.rebuild_tree_paths();

  -- ── Mark import as rolled back ─────────────────────────────────────────────
  UPDATE public.los_imports SET status = 'rolled_back' WHERE id = p_import_id;

  RETURN jsonb_build_object('restored', v_restored, 'import_id', p_import_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_absent_los_members(text[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_absent_los_members(text[], uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rollback_los_import(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rollback_los_import(uuid) TO service_role;
