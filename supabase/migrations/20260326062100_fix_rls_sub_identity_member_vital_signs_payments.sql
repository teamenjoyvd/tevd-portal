-- ============================================================
-- SEQ261: Fix broken auth.jwt() ->> 'sub' identity policies
-- 'sub' resolves to Supabase Auth UUID -- non-existent for Clerk
-- users. Replace with get_my_profile_id() which resolves via
-- the clerk_id claim already present in the Clerk JWT.
-- ============================================================

-- ---- member_vital_signs ----

DROP POLICY IF EXISTS "mvs_select" ON public.member_vital_signs;

CREATE POLICY "mvs_select" ON public.member_vital_signs
  FOR SELECT
  USING (
    (profile_id = get_my_profile_id())
    OR is_admin()
  );

-- ---- payments ----

DROP POLICY IF EXISTS "payments_member_select" ON public.payments;
DROP POLICY IF EXISTS "payments_member_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_member_update" ON public.payments;

-- Member reads their own payment rows (scoped to profile_id, not logged_by_admin)
CREATE POLICY "payments_member_select" ON public.payments
  FOR SELECT
  USING (profile_id = get_my_profile_id());

-- Member submits their own payment (must not be an admin-logged entry)
CREATE POLICY "payments_member_insert" ON public.payments
  FOR INSERT
  WITH CHECK (
    (profile_id = get_my_profile_id())
    AND (logged_by_admin IS NULL)
  );

-- Member confirms an admin-logged payment (logged_by_admin IS NOT NULL = admin initiated it)
CREATE POLICY "payments_member_update" ON public.payments
  FOR UPDATE
  USING (
    (profile_id = get_my_profile_id())
    AND (logged_by_admin IS NOT NULL)
  );
