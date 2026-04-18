-- [2604-FEAT-61] GCR fixes: index, tighten SELECT and INSERT RLS policies
-- Applied separately because trip_messages table was already created in 20260418000000.

-- Performance: index for primary access pattern (WHERE trip_id = ?)
CREATE INDEX idx_trip_messages_trip_id ON trip_messages(trip_id);

-- Tighten SELECT: exclude soft-cancelled approved registrations
DROP POLICY "trip_messages_select" ON trip_messages;
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

-- Tighten INSERT: enforce created_by = caller's profile (defence-in-depth)
DROP POLICY "trip_messages_insert" ON trip_messages;
CREATE POLICY "trip_messages_insert" ON trip_messages FOR INSERT
  WITH CHECK (get_my_role() = 'admin' AND created_by = get_my_profile_id());
