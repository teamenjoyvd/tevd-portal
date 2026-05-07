-- ── los_imports audit table ───────────────────────────────────────────────────

CREATE TABLE public.los_imports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by   uuid        REFERENCES public.profiles(id),
  status        text        NOT NULL CHECK (status IN ('complete', 'partial', 'rolled_back')),
  file_count    integer     NOT NULL DEFAULT 1,
  row_count     integer     NOT NULL DEFAULT 0,
  removed_count integer     NOT NULL DEFAULT 0,
  snapshot      jsonb       NOT NULL,
  imported_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.los_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on los_imports"
  ON public.los_imports
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── Transactional import_los_members (replaces row-loop version) ──────────────

CREATE OR REPLACE FUNCTION public.import_los_members(
  p_rows               jsonb,
  p_imported_by        uuid    DEFAULT NULL,
  p_expected_row_count integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r                jsonb;
  v_entry_date     date;
  v_renewal_date   date;
  v_inserted       integer := 0;
  v_removed        integer := 0;
  v_snapshot       jsonb;
  v_import_id      uuid    := gen_random_uuid();
  v_incoming_abos  text[];
BEGIN
  -- Optimistic concurrency check
  IF p_expected_row_count IS NOT NULL THEN
    IF (SELECT COUNT(*) FROM public.los_members) != p_expected_row_count THEN
      RAISE EXCEPTION 'Concurrency mismatch: expected % rows in los_members but found %. Re-fetch and re-diff before importing.',
        p_expected_row_count, (SELECT COUNT(*) FROM public.los_members);
    END IF;
  END IF;

  -- Snapshot current state
  SELECT jsonb_agg(row_to_json(lm)::jsonb)
    INTO v_snapshot
    FROM public.los_members lm;
  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  -- Build incoming ABO set
  SELECT ARRAY(
    SELECT elem->>'abo_number'
    FROM jsonb_array_elements(p_rows) AS elem
    WHERE nullif(elem->>'abo_number', '') IS NOT NULL
  ) INTO v_incoming_abos;

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

  -- Server-side removal
  DELETE FROM public.los_members
  WHERE abo_number != ALL(v_incoming_abos);
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Rebuild tree paths
  PERFORM public.rebuild_tree_paths();

  -- Record import
  INSERT INTO public.los_imports (id, imported_by, status, row_count, removed_count, snapshot)
  VALUES (v_import_id, p_imported_by, 'complete', v_inserted, v_removed, v_snapshot);

  RETURN jsonb_build_object(
    'inserted',  v_inserted,
    'removed',   v_removed,
    'import_id', v_import_id,
    'errors',    '[]'::jsonb
  );
END;
$$;

-- ── rollback_los_import ────────────────────────────────────────────────────────

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
  SELECT snapshot INTO v_snapshot
  FROM public.los_imports
  WHERE id = p_import_id AND status != 'rolled_back';

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Import % not found or already rolled back', p_import_id;
  END IF;

  SELECT ARRAY(
    SELECT elem->>'abo_number'
    FROM jsonb_array_elements(v_snapshot) AS elem
    WHERE nullif(elem->>'abo_number', '') IS NOT NULL
  ) INTO v_snap_abos;

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

  PERFORM public.rebuild_tree_paths();

  UPDATE public.los_imports SET status = 'rolled_back' WHERE id = p_import_id;

  RETURN jsonb_build_object('restored', v_restored, 'import_id', p_import_id);
END;
$$;
