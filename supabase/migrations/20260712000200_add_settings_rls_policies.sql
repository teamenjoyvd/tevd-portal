-- #555: add the two Pattern-A RLS policies public.settings has in prod
-- (verified 2026-07-12 via Management API: relrowsecurity=true, 2 policies).
-- Forward-fix migration so existing local databases pick the policies up
-- without a destructive reset; idempotent and a net no-op on prod, where the
-- identical policies already exist. Admins may read/write settings via the
-- Data API; anon/authenticated non-admins get nothing. App server code uses
-- the service-role client (bypasses RLS) either way.

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read settings" ON public.settings;
CREATE POLICY "Admin read settings"
  ON public.settings FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "Admin write settings" ON public.settings;
CREATE POLICY "Admin write settings"
  ON public.settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
