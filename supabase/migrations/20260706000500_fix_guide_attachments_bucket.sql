-- =============================================================================
-- Migration: 20260706000500_fix_guide_attachments_bucket.sql
-- Description: Updates the guide-attachments bucket to be private (non-public),
--              and restricts SELECT access to authenticated users only.
-- =============================================================================

-- 1. Upsert the bucket configuration to set public = false
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('guide-attachments', 'guide-attachments', false, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Drop the insecure public read policy
DROP POLICY IF EXISTS "guide-attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "guide-attachments authenticated read" ON storage.objects;

-- 3. Create a secured policy for authenticated users only
CREATE POLICY "guide-attachments authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'guide-attachments');
