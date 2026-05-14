-- Create trip-hero-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-hero-images',
  'trip-hero-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Service role can insert
CREATE POLICY "Service role can upload trip hero images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'trip-hero-images');

-- Service role can update (overwrite)
CREATE POLICY "Service role can update trip hero images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'trip-hero-images');

-- Service role can delete
CREATE POLICY "Service role can delete trip hero images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'trip-hero-images');

-- Public can read (bucket is public, but explicit policy for clarity)
CREATE POLICY "Public can read trip hero images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trip-hero-images');
