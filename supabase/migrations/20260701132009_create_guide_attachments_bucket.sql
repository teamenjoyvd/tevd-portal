-- Create guide-attachments bucket for guide attachment files (PDF, images, and
-- other document types allow-listed at the app level).
-- Uploads/deletes go through the service_role-only route handler, which bypasses
-- RLS by design (service_role has BYPASSRLS). This policy only covers public
-- read of the resulting public URLs.
-- No bucket-level MIME allow-list: arbitrary types (e.g. .docx, .zip) are
-- intentionally permitted through the app-level check as 'other'; a bucket-level
-- allow-list would block them before that logic ever runs.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('guide-attachments', 'guide-attachments', true, 20971520)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "guide-attachments public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'guide-attachments');
