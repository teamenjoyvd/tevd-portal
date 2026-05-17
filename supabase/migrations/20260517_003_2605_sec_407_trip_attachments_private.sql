-- [2605-SEC-407] Make trip-attachments bucket private; backfill file_url to path-only
--
-- Prerequisites:
--   1. Flip trip-attachments bucket to private in Supabase dashboard FIRST.
--   2. Then apply this migration.
--
-- This migration:
--   a. Drops the public read storage policy on trip-attachments.
--   b. Backfills trip_attachments.file_url: strips the public URL prefix, leaving only the storage path.
--      NOTE: the column is named file_url but its contract changes to storage path-only.
--      The column is not renamed to avoid cascading schema/type/reference changes.

-- a) Drop the public read policy
DROP POLICY IF EXISTS "trip_attachments_public_select" ON storage.objects;

-- b) Backfill file_url: convert full public URLs to path-only
--    Pattern: https://<host>/storage/v1/object/public/trip-attachments/<path>
--    Result:  <path>  (e.g. "trip-uuid/filename.pdf")
UPDATE trip_attachments
SET file_url = regexp_replace(
  file_url,
  '^.+/storage/v1/object/public/trip-attachments/',
  ''
)
WHERE file_url IS NOT NULL
  AND file_url LIKE '%/storage/v1/object/public/trip-attachments/%';
