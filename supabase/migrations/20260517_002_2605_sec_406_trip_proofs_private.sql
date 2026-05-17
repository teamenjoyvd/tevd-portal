-- [2605-SEC-406] Make trip-proofs bucket private; backfill proof_url to path-only
--
-- Prerequisites:
--   1. Flip trip-proofs bucket to private in Supabase dashboard FIRST.
--   2. Then apply this migration.
--
-- This migration:
--   a. Drops the public read storage policy on trip-proofs.
--   b. Backfills payments.proof_url: strips the public URL prefix, leaving only the storage path.

-- a) Drop the public read policy
DROP POLICY IF EXISTS "Public can read trip proofs" ON storage.objects;

-- b) Backfill proof_url: convert full public URLs to path-only
--    Pattern: https://<host>/storage/v1/object/public/trip-proofs/<path>
--    Result:  <path>  (e.g. "abc-123/receipt.jpg")
UPDATE payments
SET proof_url = regexp_replace(
  proof_url,
  '^.+/storage/v1/object/public/trip-proofs/',
  ''
)
WHERE proof_url IS NOT NULL
  AND proof_url LIKE '%/storage/v1/object/public/trip-proofs/%';
