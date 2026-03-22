-- SEQ214-ISS0190: Unify payments schema
-- Drop trip_payments, introduce dual-approval flow on unified payments table

-- ── 1. Drop trip_payments (zero rows, confirmed safe) ──────────────────────
DROP TABLE IF EXISTS public.trip_payments CASCADE;

-- ── 2. Drop old payment_status enum (was only used by trip_payments) ───────
DROP TYPE IF EXISTS public.payment_status;

-- ── 3. Drop existing RLS policies on payments before altering columns ──────
DROP POLICY IF EXISTS payments_admin_core_all  ON public.payments;
DROP POLICY IF EXISTS payments_member_insert   ON public.payments;
DROP POLICY IF EXISTS payments_member_select   ON public.payments;

-- ── 4. Drop old status column and constraint ───────────────────────────────
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS submitted_by_member;

-- ── 5. Add new columns to payments ────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN trip_id              uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  ADD COLUMN currency             text NOT NULL DEFAULT 'EUR',
  ADD COLUMN logged_by_admin      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN properties           jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN admin_status         text NOT NULL DEFAULT 'pending',
  ADD COLUMN member_status        text NOT NULL DEFAULT 'pending',
  ADD COLUMN admin_reject_reason  text,
  ADD COLUMN member_reject_reason text;

-- ── 6. Add check constraints ───────────────────────────────────────────────
ALTER TABLE public.payments
  ADD CONSTRAINT payments_admin_status_check
    CHECK (admin_status IN ('pending', 'approved', 'rejected')),
  ADD CONSTRAINT payments_member_status_check
    CHECK (member_status IN ('pending', 'approved', 'rejected'));

-- Entity check: exactly one of trip_id / payable_item_id must be set
ALTER TABLE public.payments
  ADD CONSTRAINT payments_entity_check
    CHECK (num_nonnulls(trip_id, payable_item_id) = 1);

-- ── 7. Make payable_item_id nullable (trip payments have no payable_item_id) 
ALTER TABLE public.payments
  ALTER COLUMN payable_item_id DROP NOT NULL;

-- ── 8. Alter payable_items ─────────────────────────────────────────────────
ALTER TABLE public.payable_items
  ADD COLUMN properties jsonb NOT NULL DEFAULT '{}';

-- Replace item_type check (remove 'trip', add 'merchandise')
ALTER TABLE public.payable_items
  DROP CONSTRAINT IF EXISTS payable_items_item_type_check;

ALTER TABLE public.payable_items
  ADD CONSTRAINT payable_items_item_type_check
    CHECK (item_type IN ('merchandise', 'ticket', 'food', 'book', 'other'));

-- ── 9. Recreate RLS on payments ────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admin/core: full access
CREATE POLICY payments_admin_core_all ON public.payments
  FOR ALL
  USING (
    (auth.jwt() ->> 'user_role') IN ('admin', 'core')
  );

-- Member SELECT: own rows only
CREATE POLICY payments_member_select ON public.payments
  FOR SELECT
  USING (
    profile_id = (
      SELECT id FROM public.profiles
      WHERE clerk_id = (auth.jwt() ->> 'sub')
      LIMIT 1
    )
  );

-- Member INSERT: own profile, member-initiated only (logged_by_admin must be NULL)
CREATE POLICY payments_member_insert ON public.payments
  FOR INSERT
  WITH CHECK (
    profile_id = (
      SELECT id FROM public.profiles
      WHERE clerk_id = (auth.jwt() ->> 'sub')
      LIMIT 1
    )
    AND logged_by_admin IS NULL
  );

-- Member UPDATE: only on admin-logged entries (to acknowledge/reject)
-- Column-level restriction enforced at API layer
CREATE POLICY payments_member_update ON public.payments
  FOR UPDATE
  USING (
    profile_id = (
      SELECT id FROM public.profiles
      WHERE clerk_id = (auth.jwt() ->> 'sub')
      LIMIT 1
    )
    AND logged_by_admin IS NOT NULL
  );
