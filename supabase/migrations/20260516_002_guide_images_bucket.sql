-- Create guide-images bucket for guide body inline images.
-- guide-covers remains for cover images only — separate concern, separate bucket.
-- Mirrors the guide-covers RLS pattern exactly.

INSERT INTO storage.buckets (id, name, public)
VALUES ('guide-images', 'guide-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "guide_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'guide-images');

-- Admin insert (signed URL PUT path)
CREATE POLICY "guide_images_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guide-images'
  AND is_admin()
);
