-- SEQ262: Migrate Pattern B raw jwt() role checks to Pattern A helper functions
-- Tables: guides, bento_config, social_posts, payable_items, vital_sign_definitions

-- ============================================================
-- bento_config
-- ============================================================
DROP POLICY IF EXISTS "bento_config_update" ON bento_config;
CREATE POLICY "bento_config_update" ON bento_config
  FOR UPDATE
  USING (is_admin());

-- ============================================================
-- guides
-- ============================================================
DROP POLICY IF EXISTS "howtos_delete_admin" ON guides;
CREATE POLICY "howtos_delete_admin" ON guides
  FOR DELETE
  USING (is_admin());

DROP POLICY IF EXISTS "howtos_insert_admin" ON guides;
CREATE POLICY "howtos_insert_admin" ON guides
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "howtos_select_admin_core" ON guides;
CREATE POLICY "howtos_select_admin_core" ON guides
  FOR SELECT
  USING (get_my_role() = ANY (ARRAY['admin'::public.user_role, 'core'::public.user_role]));

-- Fix: was using auth.jwt() -> 'user_role' (jsonb) cast via text — fragile.
-- Cast get_my_role() to text to compare against the text[] access_roles column.
DROP POLICY IF EXISTS "howtos_select_published" ON guides;
CREATE POLICY "howtos_select_published" ON guides
  FOR SELECT
  USING (
    is_published = true
    AND get_my_role()::text = ANY (access_roles)
  );

DROP POLICY IF EXISTS "howtos_update_admin" ON guides;
CREATE POLICY "howtos_update_admin" ON guides
  FOR UPDATE
  USING (is_admin());

-- ============================================================
-- payable_items
-- ============================================================
DROP POLICY IF EXISTS "payable_items_admin_core_all" ON payable_items;
CREATE POLICY "payable_items_admin_core_all" ON payable_items
  FOR ALL
  USING (get_my_role() = ANY (ARRAY['admin'::public.user_role, 'core'::public.user_role]));

-- ============================================================
-- social_posts
-- ============================================================
DROP POLICY IF EXISTS "social_posts_delete_admin" ON social_posts;
CREATE POLICY "social_posts_delete_admin" ON social_posts
  FOR DELETE
  USING (is_admin());

DROP POLICY IF EXISTS "social_posts_insert_admin" ON social_posts;
CREATE POLICY "social_posts_insert_admin" ON social_posts
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "social_posts_update_admin" ON social_posts;
CREATE POLICY "social_posts_update_admin" ON social_posts
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- vital_sign_definitions
-- ============================================================
DROP POLICY IF EXISTS "vsd_delete_admin" ON vital_sign_definitions;
CREATE POLICY "vsd_delete_admin" ON vital_sign_definitions
  FOR DELETE
  USING (is_admin());

DROP POLICY IF EXISTS "vsd_insert_admin" ON vital_sign_definitions;
CREATE POLICY "vsd_insert_admin" ON vital_sign_definitions
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "vsd_update_admin" ON vital_sign_definitions;
CREATE POLICY "vsd_update_admin" ON vital_sign_definitions
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());
