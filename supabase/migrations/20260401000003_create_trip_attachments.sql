-- Table
CREATE TABLE trip_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  file_type   text NOT NULL CHECK (file_type IN ('pdf', 'image')),
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid NOT NULL REFERENCES profiles(id)
);

-- RLS
ALTER TABLE trip_attachments ENABLE ROW LEVEL SECURITY;

-- Admin: full write access
CREATE POLICY "admin_all_trip_attachments"
  ON trip_attachments
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Approved attendees: SELECT only
CREATE POLICY "attendee_select_trip_attachments"
  ON trip_attachments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_registrations tr
      WHERE tr.trip_id = trip_attachments.trip_id
        AND tr.profile_id = get_my_profile_id()
        AND tr.status = 'approved'
    )
  );

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-attachments', 'trip-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read
CREATE POLICY "trip_attachments_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-attachments');

-- Storage RLS: admin write
CREATE POLICY "trip_attachments_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trip-attachments' AND is_admin());

CREATE POLICY "trip_attachments_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trip-attachments' AND is_admin());
