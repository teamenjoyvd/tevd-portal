-- AUDIT #479 (HIGH, root cause of #475/#476/#477): every SECURITY DEFINER
-- function in public defaulted to anon/authenticated EXECUTE. Traced every
-- app call site (grep for .rpc(...) plus createServiceClient()/createBrowserClient
-- usage) for the 24 unguarded, no-legitimate-anon-need signatures below —
-- all are called exclusively via service_role, pg_cron, or internal
-- function-to-function calls. The internal-call paths are safe to restrict
-- because every function involved (including the SECURITY INVOKER
-- rebuild_tree_paths(), which calls upsert_tree_node() from inside
-- purge_absent_los_members/rollback_los_import/promote_to_primary) is owned
-- by postgres — function owners always retain implicit EXECUTE on their own
-- functions regardless of REVOKE. Restrict to service_role only.
--
-- NOT touched here: approve_event_role_request, approve_member_verification,
-- dissolve_partnership, promote_to_primary — these already self-guard
-- (auth.role() <> 'service_role' AND NOT is_admin()) per the issue's own
-- lower-risk classification; left as-is to keep this diff scoped to the
-- systemic default-grant fix.

-- Guarded (#547): some of these functions exist in prod but not on a fresh
-- local replay (created outside the migration chain, e.g.
-- fn_guard_abo_number_null). Existence-checked loop — identical semantics
-- to the original per-function REVOKE/GRANT pairs wherever the function exists.
DO $do$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.fn_guard_abo_number_null()',
    'public.fn_profiles_field_audit()',
    'public.fn_reschedule_guest_reminders()',
    'public.fn_schedule_guest_reminders()',
    'public.fn_schedule_guest_reminders_record(uuid, timestamptz, text)',
    'public.get_core_ancestors(uuid)',
    'public.get_los_members_with_profiles()',
    'public.get_trip_team_attendees(uuid, uuid)',
    'public.import_los_members(jsonb)',
    'public.import_los_members(jsonb, uuid)',
    'public.increment_share_link_click(uuid)',
    'public.notify_calendar_event_created()',
    'public.notify_doc_expiry()',
    'public.notify_registration_status_change()',
    'public.notify_role_request()',
    'public.notify_role_request_status_change()',
    'public.notify_trip_attachment()',
    'public.notify_trip_created()',
    'public.notify_trip_message()',
    'public.notify_trip_request()',
    'public.notify_verification_request()',
    'public.pin_social_post(uuid)',
    'public.run_los_digest()',
    'public.upsert_tree_node(uuid, text, text)'
  ]
  LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END
$do$;

-- Systemic fix: default Postgres behavior grants EXECUTE on new functions to
-- PUBLIC. Explicit FOR ROLE postgres (the owner of every function in this
-- schema, confirmed via pg_proc.proowner) rather than relying on whichever
-- role happens to run the migration. Future SECURITY DEFINER functions in
-- this schema will no longer be anon/authenticated-executable unless
-- explicitly granted.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
