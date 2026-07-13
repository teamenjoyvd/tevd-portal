-- ROLLBACK: ALTER TABLE public.los_members DROP COLUMN IF EXISTS last_updated_by_abo;
--           then re-apply the prior import_los_members / get_los_members_with_profiles
--           definitions from 20260507000001 and 20260315000000 (baseline).
-- ============================================================
-- Track WHO last updated each LOS member, to surface "last updated"
-- and flag when a member's data was last written by an UPLINE
-- (a senior CORE whose submission included them) rather than by the
-- member's own submission.
--
-- Under the CORE scope rule (a submission's root == the submitter's own
-- ABO), any submission that contains member X where X != root is by an
-- upline of X. So: last_updated_by_abo != X.abo_number  ⇒  updated by upline.
-- ============================================================

ALTER TABLE public.los_members
  ADD COLUMN IF NOT EXISTS last_updated_by_abo text NULL;

-- ── import_los_members — carry an optional per-row `updated_by_abo` owner ──────
-- Backward compatible: admin manual imports (rows without updated_by_abo) leave
-- the existing value intact via COALESCE. Only the merged CORE-submission path
-- (mergeSubmissions annotates each winning row) sets it.

CREATE OR REPLACE FUNCTION public.import_los_members(
  p_rows        jsonb,
  p_imported_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted  integer;
  v_snapshot  jsonb;
  v_import_id uuid := gen_random_uuid();
BEGIN
  SELECT jsonb_agg(row_to_json(lm)::jsonb)
    INTO v_snapshot
    FROM public.los_members lm;
  v_snapshot := COALESCE(v_snapshot, '[]'::jsonb);

  INSERT INTO public.los_members (
    abo_number, sponsor_abo_number, abo_level, country, name,
    entry_date, phone, email, address, renewal_date,
    gpv, ppv, bonus_percent, gbv, customer_pv, ruby_pv,
    customers, points_to_next_level, qualified_legs, group_size,
    personal_order_count, group_orders_count, sponsoring,
    annual_ppv, last_updated_by_abo, last_synced_at
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
    nullif(r.updated_by_abo, ''),
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
    annual_ppv            text,
    updated_by_abo        text
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
    -- Preserve prior owner when this import doesn't specify one (manual imports).
    last_updated_by_abo  = COALESCE(excluded.last_updated_by_abo, public.los_members.last_updated_by_abo),
    last_synced_at       = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  PERFORM public.rebuild_tree_paths();

  INSERT INTO public.los_imports (id, imported_by, status, row_count, removed_count, snapshot)
  VALUES (v_import_id, p_imported_by, 'complete', v_inserted, 0, v_snapshot);

  RETURN jsonb_build_object(
    'inserted',  v_inserted,
    'import_id', v_import_id,
    'errors',    '[]'::jsonb
  );
END;
$$;

-- ── get_los_members_with_profiles — expose last_updated_by_abo ─────────────────
-- RETURNS TABLE signature changes, so drop + recreate (CREATE OR REPLACE cannot
-- alter the return type). Preserves SECURITY DEFINER + search_path + service_role grant.

DROP FUNCTION IF EXISTS public.get_los_members_with_profiles();

CREATE FUNCTION public.get_los_members_with_profiles()
RETURNS TABLE(
  abo_number text, sponsor_abo_number text, abo_level text, name text,
  country text, gpv numeric, ppv numeric, bonus_percent numeric,
  group_size integer, qualified_legs integer, annual_ppv numeric,
  renewal_date date, last_synced_at timestamptz, last_updated_by_abo text,
  profile_id uuid, first_name text, last_name text, role text, depth integer
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.abo_number, m.sponsor_abo_number, m.abo_level, m.name, m.country,
    m.gpv, m.ppv, m.bonus_percent, m.group_size, m.qualified_legs,
    m.annual_ppv, m.renewal_date, m.last_synced_at, m.last_updated_by_abo,
    p.id, p.first_name, p.last_name, p.role::text, t.depth
  FROM public.los_members m
  LEFT JOIN public.profiles p ON p.abo_number = m.abo_number
  LEFT JOIN public.tree_nodes t ON t.profile_id = p.id
  ORDER BY m.abo_level::integer, m.abo_number;
$$;

REVOKE EXECUTE ON FUNCTION public.get_los_members_with_profiles() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_los_members_with_profiles() TO service_role;
