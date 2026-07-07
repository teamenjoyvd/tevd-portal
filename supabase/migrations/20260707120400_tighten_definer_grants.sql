-- AUDIT #479 (HIGH, root cause of #475/#476/#477): every SECURITY DEFINER
-- function in public defaulted to anon/authenticated EXECUTE. Traced every
-- app call site (grep for .rpc(...) plus createServiceClient()/createBrowserClient
-- usage) for the 24 unguarded, no-legitimate-anon-need signatures below —
-- all are called exclusively via service_role, pg_cron, or internal
-- function-to-function calls (which run as the owner regardless of grants).
-- Restrict to service_role only.
--
-- NOT touched here: approve_event_role_request, approve_member_verification,
-- dissolve_partnership, promote_to_primary — these already self-guard
-- (auth.role() <> 'service_role' AND NOT is_admin()) per the issue's own
-- lower-risk classification; left as-is to keep this diff scoped to the
-- systemic default-grant fix.

REVOKE EXECUTE ON FUNCTION public.fn_guard_abo_number_null() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_profiles_field_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_reschedule_guest_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_schedule_guest_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_schedule_guest_reminders_record(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_core_ancestors(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_los_members_with_profiles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trip_team_attendees(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_los_members(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_los_members(jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_share_link_click(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_calendar_event_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_doc_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_registration_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_role_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_role_request_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trip_attachment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trip_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trip_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_trip_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_verification_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pin_social_post(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_los_digest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_tree_node(uuid, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_guard_abo_number_null() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_profiles_field_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reschedule_guest_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_schedule_guest_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_schedule_guest_reminders_record(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_core_ancestors(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_los_members_with_profiles() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_trip_team_attendees(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_los_members(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_los_members(jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_share_link_click(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_calendar_event_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_doc_expiry() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_registration_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_role_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_role_request_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_trip_attachment() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_trip_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_trip_message() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_trip_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_verification_request() TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_social_post(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_los_digest() TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_tree_node(uuid, text, text) TO service_role;

-- Systemic fix: default Postgres behavior grants EXECUTE on new functions to
-- PUBLIC. Future SECURITY DEFINER functions in this schema will no longer be
-- anon/authenticated-executable unless explicitly granted.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
