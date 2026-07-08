-- [2607-DEV-481] Pin search_path on 22 functions flagged by the Supabase advisor
-- `function_search_path_mutable`, including the 4 Pattern-A RLS helper functions
-- used by every RLS policy in this schema.
--
-- Uses `SET search_path = public` (not `''`) because most function bodies already
-- fully-qualify references, and `get_core_ancestors` uses the `ltree` `@>` operator,
-- which lives in the `public` schema (the `ltree` extension is installed there per
-- the `extension_in_public` advisor finding) -- an empty search_path would break
-- operator resolution for that function.
--
-- This migration is search_path pinning only. No authorization-check logic is
-- added or changed (that scope belongs to #476/#477/#479, already shipped).

-- Pattern-A RLS helper functions (load-bearing for every RLS policy in this schema)
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.get_my_profile_id() SET search_path = public;
ALTER FUNCTION public.get_my_clerk_id() SET search_path = public;

-- Remaining flagged functions
ALTER FUNCTION public.vault_read_secrets() SET search_path = public;
ALTER FUNCTION public.purge_absent_los_members(text[], uuid) SET search_path = public;
ALTER FUNCTION public.rollback_los_import(uuid) SET search_path = public;
ALTER FUNCTION public.increment_share_link_click(uuid) SET search_path = public;
ALTER FUNCTION public.update_howtos_updated_at() SET search_path = public;
ALTER FUNCTION public.pin_social_post(uuid) SET search_path = public;
ALTER FUNCTION public.update_bento_config_updated_at() SET search_path = public;
ALTER FUNCTION public.get_core_ancestors(uuid) SET search_path = public;
ALTER FUNCTION public.update_vital_signs_updated_at() SET search_path = public;
ALTER FUNCTION public.get_trip_team_attendees(uuid, uuid) SET search_path = public;
-- import_los_members(rows jsonb) already has search_path=public set; only the
-- (p_rows jsonb, p_imported_by uuid) overload is mutable.
ALTER FUNCTION public.import_los_members(jsonb, uuid) SET search_path = public;
ALTER FUNCTION public.abo_to_ltree_label(text) SET search_path = public;
ALTER FUNCTION public.rebuild_tree_paths() SET search_path = public;
ALTER FUNCTION public.get_los_members_with_profiles() SET search_path = public;
ALTER FUNCTION public.update_notification_queue_updated_at() SET search_path = public;
ALTER FUNCTION public.get_event_years() SET search_path = public;
ALTER FUNCTION public.update_notification_preferences_updated_at() SET search_path = public;
ALTER FUNCTION public.update_notification_config_updated_at() SET search_path = public;
