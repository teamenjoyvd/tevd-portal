-- =============================================================================
-- Migration: 20260706000500_fix_guide_attachments_bucket.sql
-- Description: Updates the guide-attachments bucket to be public, but enforces
--              a SELECT policy on storage.objects that aligns with the guide's
--              visibility setting (access_roles).
-- =============================================================================

-- 1. Ensure the bucket configuration sets public = true
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('guide-attachments', 'guide-attachments', true, 20971520)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Drop the old policies
DROP POLICY IF EXISTS "guide-attachments public read" ON storage.objects;
DROP POLICY IF EXISTS "guide-attachments authenticated read" ON storage.objects;

-- 3. Create a secured policy that matches guide visibility setting (access_roles)
CREATE POLICY "guide-attachments public read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'guide-attachments'
  AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.guides g
    WHERE g.id = (split_part(name, '/', 1))::uuid
      AND (
        (g.is_published = true AND (public.get_my_role())::text = ANY (g.access_roles))
        OR public.get_my_role() = ANY (ARRAY['admin'::public.user_role,'core'::public.user_role])
      )
  )
);
