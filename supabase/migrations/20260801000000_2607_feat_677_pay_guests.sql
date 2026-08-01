-- ROLLBACK: DROP POLICY IF EXISTS payment_guests_owner_insert ON public.payment_guests;
--           DROP POLICY IF EXISTS payment_guests_owner_select ON public.payment_guests;
--           DROP POLICY IF EXISTS payment_guests_admin_core_all ON public.payment_guests;
--           ALTER TABLE public.payments
--             DROP CONSTRAINT IF EXISTS payments_guest_ledger_check,
--             DROP CONSTRAINT IF EXISTS payments_guest_group_check,
--             DROP CONSTRAINT IF EXISTS payments_beneficiary_guest_id_fkey;
--           DROP INDEX IF EXISTS public.idx_payments_beneficiary_guest_id;
--           ALTER TABLE public.payments DROP COLUMN IF EXISTS beneficiary_guest_id;
--           DROP TABLE IF EXISTS public.payment_guests;
--           -- Finally, CREATE OR REPLACE submit_payment_group back to its
--           -- pre-guest definition: section 4 of
--           -- 20260731000000_2607_feat_676_pay_on_behalf.sql.
-- ============================================================
-- [2607-DEV-677] Payments on behalf of others — ad-hoc guests
--
-- The remaining beneficiary case: someone with no account at all. A member
-- brings a friend to an event and pays both fees; the friend has no ABO, no
-- Clerk user, no `profiles` row, and nothing to attach a payment to.
--
-- Identity is a free-text name (+ optional email) in `payment_guests`, owned by
-- the payer. The guest's `payments` row keeps `profile_id = the payer` — the
-- payer is financially responsible and a guest has no ledger — and names the
-- guest via `beneficiary_guest_id`. THIS IS WHY THE SECOND CHECK BELOW EXISTS:
-- it makes "credit a guest's money to some other member's ledger" structurally
-- unrepresentable rather than merely unwritten.
--
-- The consequence, and the reason this is a separate issue from #676: a payer
-- covering themselves AND a guest now has TWO rows on their own profile_id, so
-- every query computing a PERSONAL total must exclude `beneficiary_guest_id IS
-- NOT NULL`. On this codebase that is exactly one place — the trip detail
-- reducers (AttendeeView/ArchivedView `approvedTotal`); see the issue's §1.
--
-- Memory: a payment_guests row is created once and OUTLIVES its payments.
-- Neither withdraw_payment_group nor the admin group DELETE touches this table,
-- so paying for the same friend twice reuses the same row and re-types nothing.
-- The unique index makes a double-submitted inline form idempotent.
--
-- Deliberately NOT touched: get_payable_beneficiaries. Guests are merged into
-- the picker in TypeScript so that RPC stays a pure statement of LOS
-- eligibility. Note also that `relation = 'guest'` there already means something
-- else (an ABO-less APPROVED MEMBER, 20260731000000:173); ad-hoc people carry
-- relation 'external' in the API layer. Nothing from #676 is renamed.
--
-- Guard style, grants and header modeled on
-- 20260731000000_2607_feat_676_pay_on_behalf.sql.
-- ============================================================

-- ── 1. payment_guests ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_guests (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_profile_id  uuid        NOT NULL,
  name              text        NOT NULL,
  email             text        NULL,
  linked_profile_id uuid        NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_guests_pkey PRIMARY KEY (id),
  -- A blank name is not an identity. The upper bound is not decoration either:
  -- this is free text from a form and the value is rendered in the picker, the
  -- trip ledger and the admin queue.
  CONSTRAINT payment_guests_name_check
    CHECK (btrim(name) <> '' AND char_length(btrim(name)) <= 120),
  CONSTRAINT payment_guests_email_check
    CHECK (email IS NULL OR char_length(btrim(email)) <= 254),
  -- No ON DELETE on the owner, matching payments_profile_id_fkey: a profile with
  -- financial history is not silently deletable.
  CONSTRAINT payment_guests_owner_profile_id_fkey
    FOREIGN KEY (owner_profile_id) REFERENCES public.profiles(id),
  -- The link is a record, not money. If the linked member's profile is ever
  -- removed the guest row survives with the link cleared.
  CONSTRAINT payment_guests_linked_profile_id_fkey
    FOREIGN KEY (linked_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.payment_guests IS
  'Ad-hoc beneficiaries with no account (2607-DEV-677). Owned by the payer, remembered across payments, and optionally linked to a real profile by an admin — a record only, moving no money and rewriting no payments row. TWO FKs to profiles (owner_profile_id, linked_profile_id): every PostgREST embed must be hinted.';
COMMENT ON COLUMN public.payment_guests.linked_profile_id IS
  'Set manually by an admin once a guest turns out to be (or becomes) a member. Never auto-matched on email — profiles.contact_email is user-editable and unverified.';

-- One index per FK (precedent: 20260709120000_add_missing_fk_indexes.sql).
CREATE INDEX IF NOT EXISTS idx_payment_guests_owner_profile_id
  ON public.payment_guests (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_payment_guests_linked_profile_id
  ON public.payment_guests (linked_profile_id) WHERE linked_profile_id IS NOT NULL;

-- Identity is (owner, case-folded trimmed name, case-folded email). This is what
-- makes a re-submitted inline guest reuse the existing row instead of creating
-- "Ivan" twice, and it is what the ON CONFLICT in submit_payment_group targets —
-- keep the expression list below byte-identical to the one there.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_guests_owner_identity
  ON public.payment_guests (owner_profile_id, lower(btrim(name)), lower(coalesce(email, '')));

-- ── 2. payments.beneficiary_guest_id ──────────────────────────────────────────

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS beneficiary_guest_id uuid NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_beneficiary_guest_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_beneficiary_guest_id_fkey
    FOREIGN KEY (beneficiary_guest_id) REFERENCES public.payment_guests(id);

-- A guest row can only exist as part of a group submission.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_guest_group_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_guest_group_check CHECK (
    beneficiary_guest_id IS NULL OR payment_group_id IS NOT NULL
  );

-- The valuable one. A guest has no ledger, so their money sits on the PAYER's
-- ledger and nowhere else — pointing profile_id at a third party is rejected by
-- the database, not merely avoided by the RPC.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_guest_ledger_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_guest_ledger_check CHECK (
    beneficiary_guest_id IS NULL OR profile_id = paid_by_profile_id
  );

COMMENT ON COLUMN public.payments.beneficiary_guest_id IS
  'Non-null when this row covers an ad-hoc guest (2607-DEV-677). profile_id then equals paid_by_profile_id (the payer carries the guest financially), so any query computing the payer''s OWN total must exclude these rows.';

-- Partial: only guest rows carry a value.
CREATE INDEX IF NOT EXISTS idx_payments_beneficiary_guest_id
  ON public.payments (beneficiary_guest_id) WHERE beneficiary_guest_id IS NOT NULL;

-- ── 3. submit_payment_group — now three beneficiary entry shapes ──────────────
-- p_payload:
--   { trip_id, payable_item_id, currency, transaction_date, payment_method,
--     proof_url, note, total_cents, beneficiaries: [ ENTRY, ... ] }
-- where each ENTRY carries `amount_cents` plus EXACTLY ONE of:
--   { profile_id }              -- a real profile, #676, unchanged
--   { guest_id }                -- a guest already remembered by this payer
--   { guest: { name, email } }  -- a new guest, created inside this transaction
--
-- Backward compatible with the payload the currently-deployed code sends
-- (GOTCHAS row 16): an array of pure { profile_id, amount_cents } entries takes
-- exactly the path it did before.

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
  v_group_id     uuid := gen_random_uuid();
  v_rows         jsonb;
  v_resolved     jsonb;
  v_count        integer;
  v_distinct     integer;
  v_bad_kind     integer;
  v_bad_amounts  integer;
  v_bad_guest    integer;
  v_unowned      integer;
  v_unresolved   integer;
  v_total_cents  bigint;
  v_sum_cents    bigint;
  v_bad          uuid;
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

  -- Shape, positivity, guest-name sanity and the cent sum in one pass.
  -- jsonb_array_elements is re-expanded rather than staged in a TEMP TABLE: a
  -- temp table inside a SECURITY DEFINER function outlives an exception until
  -- commit and poisons the plan cache on the next call in the same session.
  SELECT count(*)::integer,
         count(*) FILTER (WHERE r.n_kinds <> 1)::integer,
         count(*) FILTER (WHERE r.amount_cents IS NULL OR r.amount_cents <= 0)::integer,
         count(*) FILTER (
           WHERE r.guest IS NOT NULL
             AND (r.guest ->> 'name' IS NULL
                  OR btrim(r.guest ->> 'name') = ''
                  OR char_length(btrim(r.guest ->> 'name')) > 120)
         )::integer,
         sum(r.amount_cents)
    INTO v_count, v_bad_kind, v_bad_amounts, v_bad_guest, v_sum_cents
  FROM (
    SELECT (e ->> 'amount_cents')::bigint AS amount_cents,
           CASE WHEN jsonb_typeof(e -> 'guest') = 'object' THEN e -> 'guest' END AS guest,
           -- coalesce, not a bare comparison: jsonb_typeof(NULL) is NULL when the
           -- key is absent, and one NULL term makes the whole sum NULL, which
           -- `<> 1` then answers NULL — so a two-kind entry passed this check
           -- unnoticed until the G8 probe caught it on DEV.
           ((e ->> 'profile_id') IS NOT NULL)::int
           + ((e ->> 'guest_id') IS NOT NULL)::int
           + (coalesce(jsonb_typeof(e -> 'guest'), '') = 'object')::int AS n_kinds
    FROM jsonb_array_elements(v_rows) AS e
  ) r;

  IF v_bad_kind > 0 THEN
    RAISE EXCEPTION 'every beneficiary needs exactly one of profile_id, guest_id or guest'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_bad_amounts > 0 THEN
    RAISE EXCEPTION 'every beneficiary amount must be a positive integer number of cents'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_bad_guest > 0 THEN
    RAISE EXCEPTION 'a guest needs a name of 1 to 120 characters' USING ERRCODE = 'P0001';
  END IF;

  v_total_cents := (p_payload ->> 'total_cents')::bigint;
  IF v_total_cents IS NULL OR v_total_cents <= 0 THEN
    RAISE EXCEPTION 'total_cents must be a positive integer' USING ERRCODE = 'P0001';
  END IF;

  -- 100_000_000 cents = 1,000,000.00, the same ceiling MAX_TOTAL_CENTS enforces
  -- in lib/payments/split.ts and app/api/payments/route.ts. Asserted here too
  -- because this is the only layer a hand-crafted request cannot skip.
  IF v_total_cents > 100000000 THEN
    RAISE EXCEPTION 'total_cents exceeds the 100000000 cent ceiling (got %)', v_total_cents
      USING ERRCODE = 'P0001';
  END IF;

  IF v_sum_cents <> v_total_cents THEN
    RAISE EXCEPTION 'beneficiary amounts sum to % cents but the total is % cents',
      v_sum_cents, v_total_cents
      USING ERRCODE = 'P0001';
  END IF;

  -- A guest_id must belong to THIS payer. Guests are private to their owner:
  -- naming someone else's guest is both a write into their address book and a
  -- probe of it.
  SELECT count(*)::integer INTO v_unowned
  FROM (
    SELECT (e ->> 'guest_id')::uuid AS guest_id
    FROM jsonb_array_elements(v_rows) AS e
    WHERE (e ->> 'guest_id') IS NOT NULL
  ) r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_guests pg
    WHERE pg.id = r.guest_id AND pg.owner_profile_id = p_payer
  );

  IF v_unowned > 0 THEN
    RAISE EXCEPTION 'one or more guests are not yours' USING ERRCODE = 'P0001';
  END IF;

  -- The real boundary for profile beneficiaries. Re-checked here, inside the
  -- transaction, because the route runs under the service client with RLS
  -- bypassed. Guests need no such check: they are the payer's own records and
  -- their money lands on the payer's own ledger by CHECK constraint.
  SELECT r.beneficiary_id INTO v_bad
  FROM (
    SELECT (e ->> 'profile_id')::uuid AS beneficiary_id
    FROM jsonb_array_elements(v_rows) AS e
    WHERE (e ->> 'profile_id') IS NOT NULL
  ) r
  WHERE NOT public.can_pay_for(p_payer, r.beneficiary_id)
  LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'profile % is not payable by %', v_bad, p_payer
      USING ERRCODE = 'P0001';
  END IF;

  -- Create the inline guests. ON CONFLICT DO NOTHING is what makes a
  -- double-submitted form idempotent, and it also absorbs two entries in the
  -- same array that normalize to the same person (the distinctness check below
  -- then rejects that array, rather than silently paying one of them twice).
  INSERT INTO public.payment_guests (owner_profile_id, name, email)
  SELECT p_payer,
         btrim(e -> 'guest' ->> 'name'),
         nullif(btrim(e -> 'guest' ->> 'email'), '')
  FROM jsonb_array_elements(v_rows) AS e
  WHERE jsonb_typeof(e -> 'guest') = 'object'
  ON CONFLICT (owner_profile_id, lower(btrim(name)), lower(coalesce(email, ''))) DO NOTHING;

  -- Collapse all three entry shapes into one resolved shape:
  -- { profile_id, guest_id, amount_cents } with exactly one id non-null.
  SELECT jsonb_agg(
           jsonb_build_object(
             'profile_id',   r.profile_id,
             'guest_id',     r.guest_id,
             'amount_cents', r.amount_cents
           )
           ORDER BY r.ord
         )
    INTO v_resolved
  FROM (
    SELECT e.ord,
           (e.entry ->> 'profile_id')::uuid   AS profile_id,
           (e.entry ->> 'amount_cents')::bigint AS amount_cents,
           CASE
             WHEN (e.entry ->> 'guest_id') IS NOT NULL THEN (e.entry ->> 'guest_id')::uuid
             WHEN jsonb_typeof(e.entry -> 'guest') = 'object' THEN (
               SELECT pg.id FROM public.payment_guests pg
               WHERE pg.owner_profile_id = p_payer
                 AND lower(btrim(pg.name)) = lower(btrim(e.entry -> 'guest' ->> 'name'))
                 AND lower(coalesce(pg.email, ''))
                     = lower(coalesce(nullif(btrim(e.entry -> 'guest' ->> 'email'), ''), ''))
             )
           END AS guest_id
    FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS e(entry, ord)
  ) r;

  -- A lookup that came back empty would mean the row we just inserted is not
  -- findable by its own identity expression — i.e. the ON CONFLICT target and
  -- this predicate have drifted apart. Fail loudly rather than insert a payment
  -- with a NULL beneficiary on the payer's own ledger.
  SELECT count(*)::integer INTO v_unresolved
  FROM jsonb_array_elements(v_resolved) AS e
  WHERE (e ->> 'profile_id') IS NULL AND (e ->> 'guest_id') IS NULL;

  IF v_unresolved > 0 THEN
    RAISE EXCEPTION 'could not resolve % guest entries' , v_unresolved USING ERRCODE = 'P0001';
  END IF;

  -- Uniqueness is asserted AFTER resolution, so { guest_id } and an inline
  -- { guest } naming the same person collide as they should.
  SELECT count(*)::integer,
         count(DISTINCT coalesce('p:' || (e ->> 'profile_id'), 'g:' || (e ->> 'guest_id')))::integer
    INTO v_count, v_distinct
  FROM jsonb_array_elements(v_resolved) AS e;

  IF v_distinct <> v_count THEN
    RAISE EXCEPTION 'a beneficiary may appear only once per group' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payments (
    profile_id, paid_by_profile_id, beneficiary_guest_id, payment_group_id,
    trip_id, payable_item_id,
    amount, currency, transaction_date,
    payment_method, proof_url, note,
    member_status, admin_status
  )
  SELECT
         -- A guest has no ledger: their row sits on the payer's, which is also
         -- what payments_guest_ledger_check requires.
         coalesce((e ->> 'profile_id')::uuid, p_payer),
         p_payer,
         (e ->> 'guest_id')::uuid,
         v_group_id,
         (p_payload ->> 'trip_id')::uuid,
         (p_payload ->> 'payable_item_id')::uuid,
         (e ->> 'amount_cents')::bigint::numeric / 100,
         COALESCE(p_payload ->> 'currency', 'EUR'),
         (p_payload ->> 'transaction_date')::date,
         p_payload ->> 'payment_method',
         p_payload ->> 'proof_url',
         p_payload ->> 'note',
         'approved',
         'pending'
  FROM jsonb_array_elements(v_resolved) AS e;

  RETURN v_group_id;
END;
$$;

COMMENT ON FUNCTION public.submit_payment_group(uuid, jsonb) IS
  'Inserts one payments row per beneficiary sharing a server-generated payment_group_id. Beneficiaries are profiles (re-validated with can_pay_for), guests already owned by the payer, or guests created inline in the same transaction. Asserts the cent amounts sum to total_cents. One transaction, so a partial group cannot exist.';

-- CREATE OR REPLACE preserves privileges; re-asserted so the grant is visible
-- next to the definition rather than only in the #676 migration.
REVOKE EXECUTE ON FUNCTION public.submit_payment_group(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.submit_payment_group(uuid, jsonb) TO service_role;

-- ── 4. RLS (Pattern A helpers only) ───────────────────────────────────────────
-- Defense-in-depth: every server route reaches this table through the service
-- client, which bypasses RLS. The enforcement that matters is the ownership
-- check inside submit_payment_group and the two CHECK constraints above.

ALTER TABLE public.payment_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_guests_admin_core_all ON public.payment_guests;
CREATE POLICY payment_guests_admin_core_all ON public.payment_guests FOR ALL
  USING (public.get_my_role() = ANY (ARRAY['admin'::public.user_role, 'core'::public.user_role]));

DROP POLICY IF EXISTS payment_guests_owner_select ON public.payment_guests;
CREATE POLICY payment_guests_owner_select ON public.payment_guests FOR SELECT
  USING (owner_profile_id = public.get_my_profile_id());

-- No owner UPDATE and no owner DELETE, deliberately: linking a guest to a member
-- is admin-only, and a guest row that has been paid against is financial history.
DROP POLICY IF EXISTS payment_guests_owner_insert ON public.payment_guests;
CREATE POLICY payment_guests_owner_insert ON public.payment_guests FOR INSERT
  WITH CHECK (owner_profile_id = public.get_my_profile_id() AND linked_profile_id IS NULL);
