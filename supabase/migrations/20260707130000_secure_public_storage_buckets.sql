-- =============================================================================
-- Migration: secure_public_storage_buckets
-- Issue: #480 (2607-DEV-480) — public storage buckets bypass role-gated content
--        access and allow anonymous object listing.
-- =============================================================================

-- 1. guide-attachments: make the bucket private. Public buckets bypass RLS
--    entirely for object GET via the public URL (confirmed via Supabase docs),
--    so the role-check SELECT policy added in 20260706175419 never actually
--    gated downloads. Reads now go through a signed-URL route that performs
--    its own app-level role check before calling createSignedUrl.
UPDATE storage.buckets SET public = false WHERE id = 'guide-attachments';

-- The existing "guide-attachments public read" policy (role/access_roles gated)
-- is left in place — now meaningful for private-bucket .list()/authenticated
-- download paths. No change needed to it here.

-- 2. Disable anonymous listing on the four lower-sensitivity public buckets.
--    Per Supabase docs, public buckets do not need a SELECT policy on
--    storage.objects for object-URL access (that path bypasses RLS). The only
--    effect of these broad SELECT policies is enabling anonymous `.list()`
--    calls against the bucket (flagged by advisor public_bucket_allows_listing).
--    Repo-wide grep found the only .list() caller (trip-hero-images, in
--    app/api/admin/trips/[id]/hero/route.ts) uses a service-role client, which
--    bypasses RLS regardless — so dropping these policies has no effect on any
--    legitimate app functionality.
DROP POLICY IF EXISTS "Public read guide-covers" ON storage.objects;
DROP POLICY IF EXISTS "guide_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "social-thumbnails public read" ON storage.objects;
DROP POLICY IF EXISTS "Public can read trip hero images" ON storage.objects;
