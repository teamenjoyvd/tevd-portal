-- Allow admins to upload to guide-covers bucket via signed URL (direct browser PUT).
-- Mirrors the trip_attachments_admin_insert pattern.
-- SELECT policy already exists ("Public read guide-covers").
-- DELETE/UPDATE not needed — signed URL flow PUTs a new uuid-based path each time.

CREATE POLICY "guide_covers_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guide-covers'
  AND is_admin()
);
