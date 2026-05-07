-- ── GCR fix: replace row-by-row loop with set-based upsert ───────────────────
--
-- The original import_los_members used a FOR loop over jsonb_array_elements,
-- issuing one INSERT ... ON CONFLICT per row. For large imports this causes
-- significant PL/pgSQL ↔ SQL context-switch overhead. This migration replaces
-- it with a single INSERT ... SELECT using jsonb_to_recordset, letting Postgres
-- plan and execute the whole upsert as one operation.
--
-- The snapshot and rollback behaviour are unchanged.

CREATE OR REPLACE FUNCTION public.import_los_members(
  p_rows        jsonb,
  p_imported_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted  integer;
  v_snapshot  jsonb;
  v_import_id uuid := gen_random_uuid();
BEGIN
  -- Snapshot current state before upsert
  SELECT jsonb_agg(row_to_json(lm)::jsonb)
    INTO v_snapshot
    FROM public.los_members lm;
  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  -- Set-based upsert: parse the entire JSONB array in one pass
  INSERT INTO public.los_members (
    abo_number, sponsor_abo_number, abo_level, country, name,
    entry_date, phone, email, address, renewal_date,
    gpv, ppv, bonus_percent, gbv, customer_pv, ruby_pv,
    customers, points_to_next_level, qualified_legs, group_size,
    personal_order_count, group_orders_count, sponsoring,
    annual_ppv, last_synced_at
  )
  SELECT
    r.abo_number,
    nullif(r.sponsor_abo_number, ''),
    r.abo_level,
    r.country,
    r.name,
    CASE
      WHEN nullif(r.entry_date, '') IS NULL THEN NULL
      WHEN r.entry_date ~ '^\d{4}-\d{2}-\d{2}$' THEN r.entry_date::date
      ELSE NULL
    END,
    r.phone,
    r.email,
    r.address,
    CASE
      WHEN nullif(r.renewal_date, '') IS NULL THEN NULL
      WHEN r.renewal_date ~ '^\d{4}-\d{2}-\d{2}$' THEN r.renewal_date::date
      ELSE NULL
    END,
    COALESCE(nullif(r.gpv,                  '')::numeric, 0),
    COALESCE(nullif(r.ppv,                  '')::numeric, 0),
    COALESCE(nullif(r.bonus_percent,         '')::numeric, 0),
    COALESCE(nullif(r.gbv,                  '')::numeric, 0),
    COALESCE(nullif(r.customer_pv,           '')::numeric, 0),
    COALESCE(nullif(r.ruby_pv,              '')::numeric, 0),
    COALESCE(nullif(r.customers,             '')::integer, 0),
    COALESCE(nullif(r.points_to_next_level,  '')::numeric, 0),
    COALESCE(nullif(r.qualified_legs,        '')::integer, 0),
    COALESCE(nullif(r.group_size,            '')::integer, 0),
    COALESCE(nullif(r.personal_order_count,  '')::integer, 0),
    COALESCE(nullif(r.group_orders_count,    '')::integer, 0),
    COALESCE(nullif(r.sponsoring,            '')::integer, 0),
    COALESCE(nullif(r.annual_ppv,            '')::numeric, 0),
    now()
  FROM jsonb_to_recordset(p_rows) AS r(
    abo_number            text,
    sponsor_abo_number    text,
    abo_level             text,
    country               text,
    name                  text,
    entry_date            text,
    phone                 text,
    email                 text,
    address               text,
    renewal_date          text,
    gpv                   text,
    ppv                   text,
    bonus_percent          text,
    gbv                   text,
    customer_pv            text,
    ruby_pv               text,
    customers             text,
    points_to_next_level   text,
    qualified_legs        text,
    group_size            text,
    personal_order_count   text,
    group_orders_count     text,
    sponsoring            text,
    annual_ppv            text
  )
  WHERE nullif(r.abo_number, '') IS NOT NULL
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

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

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
