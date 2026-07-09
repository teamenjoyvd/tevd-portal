-- Add covering indexes for foreign key columns flagged by the Supabase
-- performance advisor (unindexed_foreign_keys, 22 hits). Several are on
-- RLS-filtered hot paths (payments.profile_id, trip_registrations.profile_id).

create index if not exists idx_calendar_events_created_by on public.calendar_events (created_by);
create index if not exists idx_event_role_requests_profile_id on public.event_role_requests (profile_id);
create index if not exists idx_home_settings_featured_announcement_id on public.home_settings (featured_announcement_id);
create index if not exists idx_los_imports_imported_by on public.los_imports (imported_by);
create index if not exists idx_member_vital_signs_definition_id on public.member_vital_signs (definition_id);
create index if not exists idx_member_vital_signs_recorded_by on public.member_vital_signs (recorded_by);
create index if not exists idx_payable_items_created_by on public.payable_items (created_by);
create index if not exists idx_payable_items_linked_trip_id on public.payable_items (linked_trip_id);
create index if not exists idx_payments_logged_by_admin on public.payments (logged_by_admin);
create index if not exists idx_payments_payable_item_id on public.payments (payable_item_id);
create index if not exists idx_payments_profile_id on public.payments (profile_id);
create index if not exists idx_payments_trip_id on public.payments (trip_id);
create index if not exists idx_profiles_primary_profile_id on public.profiles (primary_profile_id);
create index if not exists idx_role_change_audit_profile_id on public.role_change_audit (profile_id);
create index if not exists idx_scheduled_reminders_event_id on public.scheduled_reminders (event_id);
create index if not exists idx_tree_nodes_parent_id on public.tree_nodes (parent_id);
create index if not exists idx_trip_attachments_created_by on public.trip_attachments (created_by);
create index if not exists idx_trip_attachments_trip_id on public.trip_attachments (trip_id);
create index if not exists idx_trip_messages_created_by on public.trip_messages (created_by);
create index if not exists idx_trip_registrations_cancelled_by on public.trip_registrations (cancelled_by);
create index if not exists idx_trip_registrations_profile_id on public.trip_registrations (profile_id);
create index if not exists idx_verification_log_request_id on public.verification_log (request_id);
