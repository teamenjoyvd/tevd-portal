-- 2605-BUG-282: LOS-authoritative verification + tree placement
--
-- Fixes:
--   1. approve_member_verification standard path now writes upline_abo_number
--   2. LOS guard at approval: rejects if claimed_abo not in los_members or
--      sponsor_abo_number mismatches claimed_upline_abo
--   3. Duplicate guard at approval: rejects if another profile already holds claimed_abo
--   4. upsert_tree_node: walks los_members.sponsor_abo_number chain (max 20 hops,
--      cycle-guard) when sponsor has no portal profile with a tree_nodes row
--   5. import_los_members: reconciles profiles.upline_abo_number and re-anchors
--      tree_nodes for any row where sponsor_abo_number changed on re-import
--   6. Backfill: sets profiles.abo_number + upline_abo_number from approved standard
--      requests (inner-joined to los_members — LOS-valid only); tree backfill follows

-- ── 1. approve_member_verification ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id  uuid,
  p_admin_note  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_req         public.abo_verification_requests%ROWTYPE;
  v_los_sponsor text;
BEGIN
  -- Lock the request row for the duration of the transaction
  SELECT * INTO v_req
  FROM public.abo_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request % not found', p_request_id;
  END IF;

  -- Guard: standard path must have a non-null claimed_abo
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
  END IF;

  IF v_req.request_type = 'standard' THEN
    -- LOS existence guard
    SELECT sponsor_abo_number INTO v_los_sponsor
    FROM public.los_members
    WHERE abo_number = v_req.claimed_abo;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ABO % not found in los_members — re-import LOS before approving', v_req.claimed_abo;
    END IF;

    -- Sponsor mismatch guard
    IF v_los_sponsor IS DISTINCT FROM v_req.claimed_upline_abo THEN
      RAISE EXCEPTION 'ABO % sponsor in LOS is % but request claims % — data mismatch',
        v_req.claimed_abo, v_los_sponsor, v_req.claimed_upline_abo;
    END IF;

    -- Duplicate guard: another profile already owns this ABO
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE abo_number = v_req.claimed_abo
        AND id <> v_req.profile_id
    ) THEN
      RAISE EXCEPTION 'ABO % is already claimed by another profile', v_req.claimed_abo;
    END IF;
  END IF;

  IF v_req.request_type = 'manual' THEN
    -- Manual path: store upline, promote role (upline_abo_number validated only for existence in route)
    UPDATE public.profiles
    SET role              = 'member',
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    -- Standard path: set abo_number + upline_abo_number + promote role
    UPDATE public.profiles
    SET role              = 'member',
        abo_number        = v_req.claimed_abo,
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  END IF;

  -- Mark approved
  UPDATE public.abo_verification_requests
  SET status      = 'approved',
      resolved_at = now(),
      admin_note  = p_admin_note
  WHERE id = p_request_id;

  -- Place in tree
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_member_verification(uuid, text) FROM PUBLIC;

-- ── 2. upsert_tree_node — LOS chain walk ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_tree_node(
  p_profile_id         uuid,
  p_abo_number         text,
  p_sponsor_abo_number text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_parent_id       uuid;
  v_parent_path     ltree;
  v_path            ltree;
  v_depth           integer;
  v_label           text;
  v_old_path        ltree;
  -- LOS chain walk
  v_walk_abo        text;
  v_next_abo        text;
  v_hops            integer;
  v_visited         text[];
BEGIN
  IF p_abo_number IS NULL THEN
    v_label     := 'p_' || replace(p_profile_id::text, '-', '');
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := NULL;
    INSERT INTO public.tree_nodes (profile_id, parent_id, path, depth)
    VALUES (p_profile_id, v_parent_id, v_path, v_depth)
    ON CONFLICT (profile_id) DO UPDATE SET
      parent_id = excluded.parent_id,
      path      = excluded.path,
      depth     = excluded.depth;
    RETURN;
  END IF;

  SELECT path
  INTO   v_old_path
  FROM   public.tree_nodes
  WHERE  profile_id = p_profile_id
  LIMIT  1;

  v_label := public.abo_to_ltree_label(p_abo_number);

  IF p_sponsor_abo_number IS NULL THEN
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := NULL;
  ELSE
    -- First attempt: find sponsor profile that already has a tree_nodes row
    SELECT tn.id, tn.path, tn.depth
    INTO   v_parent_id, v_parent_path, v_depth
    FROM   public.tree_nodes tn
    JOIN   public.profiles p ON p.id = tn.profile_id
    WHERE  p.abo_number = p_sponsor_abo_number
    LIMIT  1;

    -- If not found, walk los_members.sponsor_abo_number chain (max 20 hops, cycle guard)
    IF v_parent_id IS NULL THEN
      v_walk_abo := p_sponsor_abo_number;
      v_hops     := 0;
      v_visited  := ARRAY[p_sponsor_abo_number];

      LOOP
        EXIT WHEN v_hops >= 20;

        SELECT sponsor_abo_number INTO v_next_abo
        FROM public.los_members
        WHERE abo_number = v_walk_abo;

        EXIT WHEN NOT FOUND OR v_next_abo IS NULL;
        EXIT WHEN v_next_abo = ANY(v_visited);  -- cycle guard

        v_visited  := array_append(v_visited, v_next_abo);
        v_walk_abo := v_next_abo;
        v_hops     := v_hops + 1;

        SELECT tn.id, tn.path, tn.depth
        INTO   v_parent_id, v_parent_path, v_depth
        FROM   public.tree_nodes tn
        JOIN   public.profiles p ON p.id = tn.profile_id
        WHERE  p.abo_number = v_next_abo
        LIMIT  1;

        EXIT WHEN v_parent_id IS NOT NULL;
      END LOOP;
    END IF;

    IF v_parent_id IS NULL THEN
      -- Chain exhausted or no portal profile found — place at root
      v_path  := v_label::ltree;
      v_depth := 0;
    ELSE
      v_path  := v_parent_path || v_label::ltree;
      v_depth := v_depth + 1;
    END IF;
  END IF;

  INSERT INTO public.tree_nodes (profile_id, parent_id, path, depth)
  VALUES (p_profile_id, v_parent_id, v_path, v_depth)
  ON CONFLICT (profile_id) DO UPDATE SET
    parent_id = excluded.parent_id,
    path      = excluded.path,
    depth     = excluded.depth;

  IF v_old_path IS DISTINCT FROM v_path THEN
    PERFORM public.rebuild_tree_paths();
  END IF;
END;
$$;

-- ── 3. import_los_members — sponsor reconciliation ───────────────────────────

CREATE OR REPLACE FUNCTION public.import_los_members(rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r                 jsonb;
  v_inserted        integer := 0;
  v_errors          jsonb   := '[]'::jsonb;
  v_entry_date      date;
  v_renewal_date    date;
  -- sponsor reconciliation
  v_old_sponsor     text;
  v_new_sponsor     text;
  v_profile_id      uuid;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    BEGIN
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

      -- Snapshot old sponsor before upsert for change detection
      SELECT sponsor_abo_number INTO v_old_sponsor
      FROM public.los_members
      WHERE abo_number = r->>'abo_number';

      v_new_sponsor := nullif(r->>'sponsor_abo_number', '');

      INSERT INTO public.los_members (
        abo_number, sponsor_abo_number, abo_level, country, name,
        entry_date, phone, email, address, renewal_date,
        gpv, ppv, bonus_percent, gbv, customer_pv, ruby_pv,
        customers, points_to_next_level, qualified_legs, group_size,
        personal_order_count, group_orders_count, sponsoring,
        annual_ppv, last_synced_at
      ) VALUES (
        r->>'abo_number', v_new_sponsor, r->>'abo_level',
        r->>'country', r->>'name', v_entry_date, r->>'phone', r->>'email',
        r->>'address', v_renewal_date,
        coalesce(nullif(r->>'gpv','')::numeric,0),
        coalesce(nullif(r->>'ppv','')::numeric,0),
        coalesce(nullif(r->>'bonus_percent','')::numeric,0),
        coalesce(nullif(r->>'gbv','')::numeric,0),
        coalesce(nullif(r->>'customer_pv','')::numeric,0),
        coalesce(nullif(r->>'ruby_pv','')::numeric,0),
        coalesce(nullif(r->>'customers','')::integer,0),
        coalesce(nullif(r->>'points_to_next_level','')::numeric,0),
        coalesce(nullif(r->>'qualified_legs','')::integer,0),
        coalesce(nullif(r->>'group_size','')::integer,0),
        coalesce(nullif(r->>'personal_order_count','')::integer,0),
        coalesce(nullif(r->>'group_orders_count','')::integer,0),
        coalesce(nullif(r->>'sponsoring','')::integer,0),
        coalesce(nullif(r->>'annual_ppv','')::numeric,0),
        now()
      )
      ON CONFLICT (abo_number) DO UPDATE SET
        sponsor_abo_number=excluded.sponsor_abo_number,abo_level=excluded.abo_level,
        country=excluded.country,name=excluded.name,entry_date=excluded.entry_date,
        phone=excluded.phone,email=excluded.email,address=excluded.address,
        renewal_date=excluded.renewal_date,gpv=excluded.gpv,ppv=excluded.ppv,
        bonus_percent=excluded.bonus_percent,gbv=excluded.gbv,
        customer_pv=excluded.customer_pv,ruby_pv=excluded.ruby_pv,
        customers=excluded.customers,points_to_next_level=excluded.points_to_next_level,
        qualified_legs=excluded.qualified_legs,group_size=excluded.group_size,
        personal_order_count=excluded.personal_order_count,
        group_orders_count=excluded.group_orders_count,
        sponsoring=excluded.sponsoring,annual_ppv=excluded.annual_ppv,
        last_synced_at=now();

      -- Sponsor changed: reconcile profiles.upline_abo_number + tree_nodes
      IF v_old_sponsor IS DISTINCT FROM v_new_sponsor THEN
        SELECT id INTO v_profile_id
        FROM public.profiles
        WHERE abo_number = r->>'abo_number'
        LIMIT 1;

        IF v_profile_id IS NOT NULL THEN
          UPDATE public.profiles
          SET upline_abo_number = v_new_sponsor
          WHERE id = v_profile_id;

          PERFORM public.upsert_tree_node(
            p_profile_id         => v_profile_id,
            p_abo_number         => r->>'abo_number',
            p_sponsor_abo_number => v_new_sponsor
          );
        END IF;
      END IF;

      v_inserted := v_inserted + 1;
    EXCEPTION WHEN others THEN
      v_errors := v_errors || jsonb_build_object('abo_number', r->>'abo_number', 'error', sqlerrm);
    END;
  END LOOP;
  RETURN jsonb_build_object('inserted', v_inserted, 'errors', v_errors);
END;
$$;

-- ── 4. Backfill: profiles.abo_number + upline_abo_number ─────────────────────
-- Scope: approved standard requests where claimed_abo exists in los_members
-- Excludes profiles that already have abo_number set (safety)
-- Excludes ABO 7013414121 (not in LOS until full import)

UPDATE public.profiles p
SET
  abo_number        = v.claimed_abo,
  upline_abo_number = v.claimed_upline_abo
FROM public.abo_verification_requests v
INNER JOIN public.los_members lm ON lm.abo_number = v.claimed_abo
WHERE v.profile_id       = p.id
  AND v.status            = 'approved'
  AND v.request_type      = 'standard'
  AND v.claimed_abo       IS NOT NULL
  AND p.abo_number        IS NULL
  AND v.claimed_abo       <> '7013414121';

-- ── 5. Backfill tree nodes for newly-set profiles ────────────────────────────
-- Call upsert_tree_node for each profile that now has abo_number but
-- either has no tree_nodes row or has a placeholder path.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.abo_number, p.upline_abo_number
    FROM public.profiles p
    WHERE p.abo_number IS NOT NULL
      AND (
        NOT EXISTS (SELECT 1 FROM public.tree_nodes tn WHERE tn.profile_id = p.id)
        OR EXISTS (
          SELECT 1 FROM public.tree_nodes tn
          WHERE tn.profile_id = p.id
            AND tn.path::text LIKE 'p_%'
        )
      )
  LOOP
    PERFORM public.upsert_tree_node(
      p_profile_id         => r.profile_id,
      p_abo_number         => r.abo_number,
      p_sponsor_abo_number => r.upline_abo_number
    );
  END LOOP;
END;
$$;
