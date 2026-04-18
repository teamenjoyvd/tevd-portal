-- [2604-FEAT-61] Create trip_messages table with RLS and updated_at trigger
-- Idempotent: safe to run against a DB that already has this table (fresh dev runs).

CREATE TABLE IF NOT EXISTS trip_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_messages_trip_id ON trip_messages(trip_id);

-- Keep updated_at current on every UPDATE (drop-and-recreate is the idempotent pattern)
DROP TRIGGER IF EXISTS set_trip_messages_updated_at ON trip_messages;
CREATE TRIGGER set_trip_messages_updated_at
  BEFORE UPDATE ON trip_messages
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

-- Policies: drop-and-recreate for idempotency
DROP POLICY IF EXISTS "trip_messages_select" ON trip_messages;
CREATE POLICY "trip_messages_select" ON trip_messages FOR SELECT
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM trip_registrations tr
      WHERE tr.trip_id = trip_messages.trip_id
        AND tr.profile_id = get_my_profile_id()
        AND tr.status = 'approved'
        AND tr.cancelled_at IS NULL
    )
  );

DROP POLICY IF EXISTS "trip_messages_insert" ON trip_messages;
CREATE POLICY "trip_messages_insert" ON trip_messages FOR INSERT
  WITH CHECK (get_my_role() = 'admin' AND created_by = get_my_profile_id());

DROP POLICY IF EXISTS "trip_messages_update" ON trip_messages;
CREATE POLICY "trip_messages_update" ON trip_messages FOR UPDATE
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "trip_messages_delete" ON trip_messages;
CREATE POLICY "trip_messages_delete" ON trip_messages FOR DELETE
  USING (get_my_role() = 'admin');
