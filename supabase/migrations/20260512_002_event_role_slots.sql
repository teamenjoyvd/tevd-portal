-- 2605-FEAT-332: Event role slots — label registry
-- Slot state (open/contested/filled) is always derived at read time
-- from event_role_requests. Nothing stored here except the label.

CREATE TABLE IF NOT EXISTS event_role_slots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  role_label  text        NOT NULL CHECK (char_length(role_label) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (event_id, role_label)
);

CREATE INDEX IF NOT EXISTS event_role_slots_event_id_idx ON event_role_slots (event_id);

-- RLS
ALTER TABLE event_role_slots ENABLE ROW LEVEL SECURITY;

-- Members and above can read slots (to display available roles on an event)
CREATE POLICY "member_read_event_role_slots"
  ON event_role_slots FOR SELECT
  USING (get_my_role() IN ('member', 'core', 'admin'));

-- Admins have full write access
CREATE POLICY "admin_all_event_role_slots"
  ON event_role_slots FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
