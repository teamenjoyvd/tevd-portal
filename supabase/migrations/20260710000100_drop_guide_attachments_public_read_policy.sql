-- Issue #510: "guide-attachments public read" (storage.objects) is a pre-existing
-- policy that grants public/anon read access to any attachment on a guide tagged
-- 'guest' in access_roles, bypassing the signed-URL download route entirely
-- (app/api/guides/[slug]/attachments/[attachmentId]/download/route.ts). That route
-- already uses createServiceClient() (bypasses RLS) and performs its own
-- is_published + access_roles check, so this policy is redundant with the only
-- legitimate read path and is otherwise an unenforceable authorization boundary
-- (get_my_role() defaults to 'guest' for every anon-key caller, per ADR-002/ADR-011 —
-- no Clerk-JWT Supabase client is ever minted). Confirmed zero other code paths
-- (admin routes, upload/delete) rely on this policy — they all use the service client.

DROP POLICY IF EXISTS "guide-attachments public read" ON storage.objects;
