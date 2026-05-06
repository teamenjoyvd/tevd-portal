-- ── 1. Extend los_imports status check to include 'purge' ─────────────────────

ALTER TABLE public.los_imports
  DROP CONSTRAINT IF EXISTS los_imports_status_check;

ALTER TABLE public.los_imports
  ADD CONSTRAINT los_imports_status_check
    CHECK (status IN ('complete', 'partial', 'rolled_back', 'purge'));

-- ── 2. Drop old import_los_members signature (had p_expected_row_count) ────────
--
-- CREATE OR REPLACE cannot change the parameter list, so we must drop first.
-- The route no longer passes expected_row_count so the 2-param version is safe.

DROP FUNCTION IF EXISTS public.import_los_members(jsonb, uuid, integer);

-- ── 3. import_los_members — upsert-only, no DELETE, no concurrency check ───────

CREATE OR REPLACE FUNCTION public.import_los_members(
  p_rows        jsonb,
  p_imported_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r              jsonb;
  v_entry_date   date;
  v_renewal_date date;
  v_inserted     integer := 0;
  v_snapshot     jsonb;
  v_import_id    uuid    := gen_random_uuid();
BEGIN
  -- Snapshot current state before upsert
  SELECT jsonb_agg(row_to_json(lm)::jsonb)
    INTO v_snapshot
    FROM public.los_members lm;
  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  -- Upsert all rows
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_entry_date := CASE
      WHEN nullif(r->>'entry_date', '') IS NULL THEN NULL
      WHEN r->>'entry_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'entry_date')::date
      ELSE NULL
    END;

    v_renewal_date := CASE
      WHEN nullif(r->>'renewal_date', '') IS NULL THEN NULL
      WHEN r->>'renewal_date' ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'renewal_date')::date
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
      r->>'abo_number',
      nullif(r->>'sponsor_abo_number', ''),
      r->>'abo_level',
      r->>'country',
      r->>'name',
      v_entry_date,
      r->>'phone',
      r->>'email',
      r->>'address',
      v_renewal_date,
      COALESCE(nullif(r->>'gpv',                  '')::numeric, 0),
      COALESCE(nullif(r->>'ppv',                  '')::numeric, 0),
      COALESCE(nullif(r->>'bonus_percent',         '')::numeric, 0),
      COALESCE(nullif(r->>'gbv',                  '')::numeric, 0),
      COALESCE(nullif(r->>'customer_pv',           '')::numeric, 0),
      COALESCE(nullif(r->>'ruby_pv',              '')::numeric, 0),
      COALESCE(nullif(r->>'customers',             '')::integer, 0),
      COALESCE(nullif(r->>'points_to_next_level',  '')::numeric, 0),
      COALESCE(nullif(r->>'qualified_legs',        '')::integer, 0),
      COALESCE(nullif(r->>'group_size',            '')::integer, 0),
      COALESCE(nullif(r->>'personal_order_count',  '')::integer, 0),
      COALESCE(nullif(r->>'group_orders_count',    '')::integer, 0),
      COALESCE(nullif(r->>'sponsoring',            '')::integer, 0),
      COALESCE(nullif(r->>'annual_ppv',            '')::numeric, 0),
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

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Rebuild tree paths
  PERFORM public.rebuild_tree_paths();

  -- Record import
  INSERT INTO public.los_imports (id, imported_by, status, row_count, removed_count, snapshot)
  VALUES (v_import_id, p_imported_by, 'complete', v_inserted, 0, v_snapshot);

  RETURN jsonb_build_object(
    'inserted',  v_inserted,
    'import_id', v_import_id,
    'errors',    '[]'::jsonb
  );
END;
$$;

-- ── 4. purge_absent_los_members — deletion-only, rollback-safe ────────────────

CREATE OR REPLACE FUNCTION public.purge_absent_los_members(
  p_keep_abos   text[],
  p_imported_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_removed   integer := 0;
  v_snapshot  jsonb;
  v_import_id uuid    := gen_random_uuid();
BEGIN
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
