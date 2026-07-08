-- AUDIT #478 (CRITICAL): v_member_history, v_roles_history, member_roles_history
-- are owner-privileged views that bypass RLS on profiles_audit/profiles/
-- event_role_requests, and were SELECT-granted to anon/authenticated. No app
-- path relies on authenticated-role access — all real callers use
-- createServiceClient() (service_role), which bypasses grants entirely.
REVOKE SELECT ON public.v_member_history FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.v_roles_history FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.member_roles_history FROM PUBLIC, anon, authenticated;
