-- ISS-0043: Add soft-delete support to notifications
-- No TTL/cron jobs found to remove.

ALTER TABLE notifications ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Update user SELECT policy to exclude soft-deleted notifications.
-- Admin policy (ALL via is_admin()) is unaffected and will still see deleted rows.
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (profile_id = get_my_profile_id() AND deleted_at IS NULL);
