-- [2605-SEC-396] Fix RLS policy misconfigurations
-- email_log, member_vital_signs, payments
-- Applied to prod: 2026-05-17

-- ── 1. email_log ──────────────────────────────────────────────────
-- Was: roles:{public}, qual:true — any authenticated user could write
-- Fix: scope to service_role only (service role bypasses RLS anyway; this
--      closes the gap for anon/authenticated keys)
DROP POLICY IF EXISTS "Service role write email_log" ON public.email_log;
CREATE POLICY "Service role write email_log"
  ON public.email_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 2. member_vital_signs ───────────────────────────────────────────────
-- Was: raw auth.jwt() ->> 'user_role' = 'admin' (fragile against JWT template drift)
-- Fix: use is_admin() helper, consistent with every other table
DROP POLICY IF EXISTS "mvs_delete_admin" ON public.member_vital_signs;
DROP POLICY IF EXISTS "mvs_insert_admin" ON public.member_vital_signs;

CREATE POLICY "mvs_delete_admin"
  ON public.member_vital_signs FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE POLICY "mvs_insert_admin"
  ON public.member_vital_signs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ── 3. payments ─────────────────────────────────────────────────────────────
-- Was: raw auth.jwt() ->> 'user_role' = ANY (ARRAY['admin', 'core'])
-- Fix: use get_my_role() cast to user_role enum (Pattern A)
DROP POLICY IF EXISTS "payments_admin_core_all" ON public.payments;

CREATE POLICY "payments_admin_core_all"
  ON public.payments FOR ALL
  TO authenticated
  USING (get_my_role() = ANY (ARRAY['admin'::user_role, 'core'::user_role]))
  WITH CHECK (get_my_role() = ANY (ARRAY['admin'::user_role, 'core'::user_role]));
