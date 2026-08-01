-- ROLLBACK: DROP POLICY IF EXISTS payments_payer_select ON public.payments;
--           DROP POLICY IF EXISTS payments_member_insert ON public.payments;
--           CREATE POLICY "payments_member_insert" ON public.payments FOR INSERT
--             WITH CHECK (profile_id = get_my_profile_id() AND logged_by_admin IS NULL);
--           DROP FUNCTION IF EXISTS public.withdraw_payment_group(uuid, uuid);
--           DROP FUNCTION IF EXISTS public.submit_payment_group(uuid, jsonb);
--           DROP FUNCTION IF EXISTS public.can_pay_for(uuid, uuid);
--           DROP FUNCTION IF EXISTS public.get_payable_beneficiaries(uuid, uuid);
--           DROP INDEX IF EXISTS public.idx_payments_paid_by_profile_id;
--           DROP INDEX IF EXISTS public.idx_payments_payment_group_id;
--           ALTER TABLE public.payments
--             DROP CONSTRAINT IF EXISTS payments_group_pair_check,
--             DROP COLUMN IF EXISTS paid_by_profile_id,
--             DROP COLUMN IF EXISTS payment_group_id;
-- ============================================================
-- [2607-DEV-676] Payments on behalf of others — profile beneficiaries
--
-- One submission + one proof produces N sibling `payments` rows that
-- share a `payment_group_id`; each row lands on its beneficiary's own
-- ledger (`profile_id`) while `paid_by_profile_id` records who actually
-- transferred the money. Legacy self-payments keep BOTH columns NULL —
-- there is no backfill, and the pair CHECK below makes "half a group"
-- unrepresentable.
--
-- Eligibility is defined ONCE, in SQL: `get_payable_beneficiaries`
-- feeds the picker and `can_pay_for` (a thin EXISTS over it) is the
-- enforcement check re-run inside `submit_payment_group`. Because every
-- server route uses createServiceClient() (RLS bypassed, ADR-002/011),
-- that in-transaction re-check — not RLS — is the real security boundary.
--
-- Hard boundary: nothing here ever reaches UPWARD. The downline branch is
-- strictly directional (`descendant <@ viewer`, never the reverse), so an
-- upline can never be paid for by a downline.
--
-- Guard style, grants and header modeled on
-- 20260713000000_2607_feat_los_submission_requests.sql.
-- `SET search_path = public` is correct for the ltree `<@` operator: the
-- ltree extension is installed in `public` on this project (verified on the
-- DEV project 2026-07-31; see 20260707000100_add_function_search_path.sql).
-- ============================================================

-- ── 1. Columns ────────────────────────────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_group_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS paid_by_profile_id uuid NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_paid_by_profile_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_paid_by_profile_id_fkey
    FOREIGN KEY (paid_by_profile_id) REFERENCES public.profiles(id);

-- Both-or-neither. Passes on every existing row (legacy = both NULL).
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_group_pair_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_group_pair_check CHECK (
    (payment_group_id IS NULL AND paid_by_profile_id IS NULL)
    OR (payment_group_id IS NOT NULL AND paid_by_profile_id IS NOT NULL)
  );

COMMENT ON COLUMN public.payments.payment_group_id IS
  'Non-null on rows created by submit_payment_group: all siblings of one on-behalf submission share this id and are approved, rejected or withdrawn only as a whole group. NULL on legacy/self-paid rows.';
COMMENT ON COLUMN public.payments.paid_by_profile_id IS
  'The profile that actually transferred the money and owns the proof image. NULL on legacy/self-paid rows, where the payer is profile_id. Third FK to profiles — every PostgREST embed must be hinted.';

-- One index per FK (precedent: 20260709120000_add_missing_fk_indexes.sql).
-- Partial: the overwhelming majority of rows are legacy singles with both NULL.
CREATE INDEX IF NOT EXISTS idx_payments_payment_group_id
  ON public.payments (payment_group_id) WHERE payment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_paid_by_profile_id
  ON public.payments (paid_by_profile_id) WHERE paid_by_profile_id IS NOT NULL;

-- ── 2. get_payable_beneficiaries — the single definition of eligibility ───────
-- p_target pushes the predicate into every branch so the per-beneficiary
-- enforcement check never re-enumerates a whole leg.

CREATE OR REPLACE FUNCTION public.get_payable_beneficiaries(
  p_viewer uuid,
  p_target uuid DEFAULT NULL
)
RETURNS TABLE(
  profile_id uuid,
  first_name text,
  last_name  text,
  abo_number text,
  role       text,
  relation   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer      public.profiles%ROWTYPE;
  v_anchor      uuid;
  v_anchor_path ltree;
BEGIN
  SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Guests may only ever pay for themselves. /api/payments already 403s them;
  -- this is the same rule stated where it cannot be routed around.
  IF v_viewer.role = 'guest' THEN
    IF p_target IS NULL OR p_target = p_viewer THEN
      RETURN QUERY
      SELECT p.id, p.first_name, p.last_name, p.abo_number, p.role::text, 'self'::text
      FROM public.profiles p WHERE p.id = p_viewer;
    END IF;
    RETURN;
  END IF;

  -- A secondary profile borrows its primary's tree node (ADR-016: co-owners
  -- have no tree_nodes row at all). Mirrors app/api/profile/los-summary/route.ts:16.
  v_anchor := COALESCE(v_viewer.primary_profile_id, v_viewer.id);
  SELECT tn.path INTO v_anchor_path
  FROM public.tree_nodes tn WHERE tn.profile_id = v_anchor;

  RETURN QUERY
  WITH cand AS (
    -- self
    SELECT p.id AS cid, 0 AS prio, 'self'::text AS rel
    FROM public.profiles p
    WHERE p.id = p_viewer
      AND (p_target IS NULL OR p.id = p_target)

    UNION ALL

    -- household: co-owner / spouse, in both directions
    SELECT p.id, 1, 'household'::text
    FROM public.profiles p
    WHERE p.id <> p_viewer
      AND (p.primary_profile_id = p_viewer OR p.id = v_viewer.primary_profile_id)
      AND (p_target IS NULL OR p.id = p_target)

    UNION ALL

    -- strict downline, anchoring BOTH sides on the primary profile so a
    -- downline's spouse is reachable transitively (no recursion needed)
    SELECT p.id, 2, 'downline'::text
    FROM public.profiles p
    JOIN public.tree_nodes tn ON tn.profile_id = COALESCE(p.primary_profile_id, p.id)
    WHERE v_anchor_path IS NOT NULL
      AND p.id <> p_viewer
      AND tn.path <@ v_anchor_path
      AND tn.path <> v_anchor_path
      AND (p_target IS NULL OR p.id = p_target)

    UNION ALL

    -- ABO-less APPROVED members: upsert_tree_node plants them as their own
    -- placeholder root (baseline.sql:407-419), so no ltree check can see them.
    -- Reach them through profiles.upline_abo_number, which only
    -- approve_member_verification and the LOS import write — deliberately NOT
    -- abo_verification_requests.claimed_upline_abo, which is self-declared and
    -- unapproved and would let anyone claiming your ABO into your picker.
    --
    -- REACHABILITY (measured on DEV 2026-07-31, not assumed): trg_guard_abo_number_null
    -- (20260716000100_normalize_prod_schema_drift.sql:25-54, live on prod and DEV)
    -- REJECTS abo_number IS NULL on any primary profile with role member or core.
    -- It exempts admin, guest and co-owners. So today this branch can only ever
    -- match an admin-role profile carrying an upline_abo_number; co-owners are
    -- already covered by `household` and by the COALESCE anchoring in `downline`.
    -- The branch is kept because it is additive and because the manual
    -- verification path (approve_member_verification, request_type='manual')
    -- sets role='member' with a NULL claimed_abo and clearly intends this
    -- category to exist — if that guard is ever relaxed, the picker is correct
    -- on day one instead of silently omitting people.
    SELECT p.id, 3, 'guest'::text
    FROM public.profiles p
    JOIN public.profiles up ON up.abo_number = p.upline_abo_number
    JOIN public.tree_nodes tn ON tn.profile_id = COALESCE(up.primary_profile_id, up.id)
    WHERE v_anchor_path IS NOT NULL
      AND p.abo_number IS NULL
      AND p.upline_abo_number IS NOT NULL
      AND p.role <> 'guest'
      AND p.id <> p_viewer
      AND tn.path <@ v_anchor_path
      AND (p_target IS NULL OR p.id = p_target)
  ),
  best AS (
    SELECT DISTINCT ON (c.cid)
           c.cid, c.prio, c.rel,
           pr.first_name AS fname, pr.last_name AS lname,
           pr.abo_number AS abo, pr.role::text AS rl
    FROM cand c
    JOIN public.profiles pr ON pr.id = c.cid
    ORDER BY c.cid, c.prio
  )
  SELECT b.cid, b.fname, b.lname, b.abo, b.rl, b.rel
  FROM best b
  ORDER BY b.prio, b.lname, b.fname;
END;
$$;

COMMENT ON FUNCTION public.get_payable_beneficiaries(uuid, uuid) IS
  'The single definition of who p_viewer may submit a payment for: self, household co-owner, strict LOS downline, and ABO-less approved members under them. Never returns an upline. Pass p_target to test one candidate without enumerating the whole leg.';

-- ── 3. can_pay_for — the enforcement predicate ────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_pay_for(
  p_payer       uuid,
  p_beneficiary uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_payable_beneficiaries(p_payer, p_beneficiary)
  );
$$;

COMMENT ON FUNCTION public.can_pay_for(uuid, uuid) IS
  'EXISTS over get_payable_beneficiaries(p_payer, p_beneficiary). One definition serves the picker and the write path, so "the UI offered someone the API then rejects" is structurally impossible.';

-- ── 4. submit_payment_group — N rows, one transaction ─────────────────────────
-- p_payload:
--   { trip_id, payable_item_id, currency, transaction_date, payment_method,
--     proof_url, note, total_cents,
--     beneficiaries: [{ profile_id, amount_cents }, ...] }
-- Amounts travel as integer cents and are asserted to sum exactly; payments.amount
-- is written as cents/100 so no float ever touches the money.

CREATE OR REPLACE FUNCTION public.submit_payment_group(
  p_payer   uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id    uuid := gen_random_uuid();
  v_rows        jsonb;
  v_count       integer;
  v_distinct    integer;
  v_bad_ids     integer;
  v_bad_amounts integer;
  v_total_cents bigint;
  v_sum_cents   bigint;
  v_bad         uuid;
BEGIN
  -- GOTCHAS row 34: SECURITY DEFINER bypasses RLS and this is a cross-user write.
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_payer IS NULL THEN
    RAISE EXCEPTION 'payer is required' USING ERRCODE = 'P0001';
  END IF;

  v_rows := p_payload -> 'beneficiaries';
  IF v_rows IS NULL OR jsonb_typeof(v_rows) <> 'array' THEN
    RAISE EXCEPTION 'beneficiaries must be an array' USING ERRCODE = 'P0001';
  END IF;

  v_count := jsonb_array_length(v_rows);
  IF v_count < 1 OR v_count > 20 THEN
    RAISE EXCEPTION 'beneficiaries must hold between 1 and 20 entries (got %)', v_count
      USING ERRCODE = 'P0001';
  END IF;

  -- Exactly one of trip_id / payable_item_id, same rule as the legacy route.
  IF ((p_payload ->> 'trip_id') IS NULL) = ((p_payload ->> 'payable_item_id') IS NULL) THEN
    RAISE EXCEPTION 'exactly one of trip_id or payable_item_id is required'
      USING ERRCODE = 'P0001';
  END IF;

  -- Shape, positivity, uniqueness and the cent sum in one pass. jsonb_array_elements
  -- is re-expanded rather than staged in a TEMP TABLE: a temp table inside a
  -- SECURITY DEFINER function outlives an exception until commit and poisons the
  -- plan cache on the next call in the same session.
  SELECT count(*)::integer,
         count(DISTINCT r.beneficiary_id)::integer,
         count(*) FILTER (WHERE r.beneficiary_id IS NULL)::integer,
         count(*) FILTER (WHERE r.amount_cents IS NULL OR r.amount_cents <= 0)::integer,
         sum(r.amount_cents)
    INTO v_count, v_distinct, v_bad_ids, v_bad_amounts, v_sum_cents
  FROM (
    SELECT (e ->> 'profile_id')::uuid     AS beneficiary_id,
           (e ->> 'amount_cents')::bigint AS amount_cents
    FROM jsonb_array_elements(v_rows) AS e
  ) r;

  IF v_bad_ids > 0 THEN
    RAISE EXCEPTION 'every beneficiary needs a profile_id' USING ERRCODE = 'P0001';
  END IF;

  IF v_bad_amounts > 0 THEN
    RAISE EXCEPTION 'every beneficiary amount must be a positive integer number of cents'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_distinct <> v_count THEN
    RAISE EXCEPTION 'a beneficiary may appear only once per group' USING ERRCODE = 'P0001';
  END IF;

  v_total_cents := (p_payload ->> 'total_cents')::bigint;
  IF v_total_cents IS NULL OR v_total_cents <= 0 THEN
    RAISE EXCEPTION 'total_cents must be a positive integer' USING ERRCODE = 'P0001';
  END IF;

  IF v_sum_cents <> v_total_cents THEN
    RAISE EXCEPTION 'beneficiary amounts sum to % cents but the total is % cents',
      v_sum_cents, v_total_cents
      USING ERRCODE = 'P0001';
  END IF;

  -- The real boundary. Re-checked here, inside the transaction, because the
  -- route runs under the service client with RLS bypassed.
  SELECT r.beneficiary_id INTO v_bad
  FROM (
    SELECT (e ->> 'profile_id')::uuid AS beneficiary_id
    FROM jsonb_array_elements(v_rows) AS e
  ) r
  WHERE NOT public.can_pay_for(p_payer, r.beneficiary_id)
  LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'profile % is not payable by %', v_bad, p_payer
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payments (
    profile_id, paid_by_profile_id, payment_group_id,
    trip_id, payable_item_id,
    amount, currency, transaction_date,
    payment_method, proof_url, note,
    member_status, admin_status
  )
  SELECT r.beneficiary_id,
         p_payer,
         v_group_id,
         (p_payload ->> 'trip_id')::uuid,
         (p_payload ->> 'payable_item_id')::uuid,
         r.amount_cents::numeric / 100,
         COALESCE(p_payload ->> 'currency', 'EUR'),
         (p_payload ->> 'transaction_date')::date,
         p_payload ->> 'payment_method',
         p_payload ->> 'proof_url',
         p_payload ->> 'note',
         'approved',
         'pending'
  FROM (
    SELECT (e ->> 'profile_id')::uuid     AS beneficiary_id,
           (e ->> 'amount_cents')::bigint AS amount_cents
    FROM jsonb_array_elements(v_rows) AS e
  ) r;

  RETURN v_group_id;
END;
$$;

COMMENT ON FUNCTION public.submit_payment_group(uuid, jsonb) IS
  'Inserts one payments row per beneficiary sharing a server-generated payment_group_id. Re-validates every beneficiary with can_pay_for and asserts the cent amounts sum to total_cents. One transaction, so a partial group cannot exist.';

-- ── 5. withdraw_payment_group — payer cancels a still-pending group ───────────
-- Ownership and pending-ness are asserted INSIDE the DELETE's WHERE clause, so
-- there is no TOCTOU window against a concurrent admin approval.

CREATE OR REPLACE FUNCTION public.withdraw_payment_group(
  p_group_id uuid,
  p_payer    uuid
)
RETURNS TABLE(deleted integer, proof_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH gone AS (
    DELETE FROM public.payments pay
    WHERE pay.payment_group_id = p_group_id
      AND pay.paid_by_profile_id = p_payer
      AND pay.admin_status = 'pending'
    RETURNING pay.proof_url AS url
  )
  SELECT count(*)::integer, max(g.url) FROM gone g;
END;
$$;

COMMENT ON FUNCTION public.withdraw_payment_group(uuid, uuid) IS
  'Hard-deletes a whole still-pending group owned by p_payer and returns the row count plus the shared proof_url so the route can best-effort remove the storage object. Returns deleted = 0 when the group is not the payer''s or is no longer pending.';

-- ── 6. Grants — service_role only ─────────────────────────────────────────────
-- Nothing is granted to `authenticated`: can_pay_for takes an ARBITRARY payer,
-- so exposing it to signed-in users would hand them an oracle for mapping the
-- entire LOS. Routes reach these through the service client.

REVOKE EXECUTE ON FUNCTION public.get_payable_beneficiaries(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_payable_beneficiaries(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.can_pay_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.can_pay_for(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.submit_payment_group(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.submit_payment_group(uuid, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.withdraw_payment_group(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.withdraw_payment_group(uuid, uuid) TO service_role;

-- ── 7. RLS (Pattern A helpers only) ───────────────────────────────────────────
-- Defense-in-depth only: no code path exercises these policies, because every
-- server route uses the service client. The real enforcement is can_pay_for
-- inside submit_payment_group.

-- The payer must be able to see rows on other people's ledgers that they paid for.
DROP POLICY IF EXISTS payments_payer_select ON public.payments;
CREATE POLICY payments_payer_select ON public.payments FOR SELECT
  USING (paid_by_profile_id = public.get_my_profile_id());

-- Self-inserts ONLY, and deliberately so.
--
-- An earlier draft admitted group rows via
-- COALESCE(paid_by_profile_id, profile_id) = get_my_profile_id(). That is a
-- privilege escalation: the COALESCE is satisfied by naming YOURSELF as
-- paid_by_profile_id while pointing profile_id at anyone at all, so a signed-in
-- user could write a row onto an upline's ledger. can_pay_for cannot backstop
-- it, because EXECUTE is revoked from `authenticated` at the grants above.
--
-- Group rows never need this policy: submit_payment_group is the only writer
-- and it runs under service_role, which bypasses RLS entirely. So the honest
-- shape is to admit nothing but a plain self-payment, and to state that group
-- columns must be absent rather than leaving them unconstrained.
DROP POLICY IF EXISTS payments_member_insert ON public.payments;
CREATE POLICY payments_member_insert ON public.payments FOR INSERT
  WITH CHECK (
    logged_by_admin IS NULL
    AND paid_by_profile_id IS NULL
    AND payment_group_id IS NULL
    AND profile_id = public.get_my_profile_id()
  );
