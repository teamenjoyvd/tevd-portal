-- =============================================================================
-- Migration: 20260706000400_fix_data_migration_payload.sql
-- Description: Corrects the payload of doc_expiry queue items where document_id
--              was wrongly set to the profile_id.
-- =============================================================================

UPDATE public.notification_queue
SET payload = payload - 'document_id'
WHERE type = 'doc_expiry'::public.notification_queue_type
  AND payload->>'document_id' = profile_id::text;
