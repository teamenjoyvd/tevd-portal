-- ── Widen event_share_links.share_method to allow 'qr' ─────────────────────
-- Adds 'qr' as a valid share method alongside 'native' and 'clipboard', so a
-- member can share an event via a downloadable QR code (issue 2607-DEV-587).
-- Additive CHECK-constraint widening only — no data rewrite; existing rows
-- ('native'/'clipboard') remain valid.
-- The original inline CHECK is auto-named event_share_links_share_method_check
-- by Postgres (table_column_check convention).
-- ROLLBACK: ALTER TABLE event_share_links DROP CONSTRAINT IF EXISTS event_share_links_share_method_check; ALTER TABLE event_share_links ADD CONSTRAINT event_share_links_share_method_check CHECK (share_method IN ('native', 'clipboard'));

ALTER TABLE event_share_links
  DROP CONSTRAINT IF EXISTS event_share_links_share_method_check;

-- Add NOT VALID first so the ADD does not take an ACCESS EXCLUSIVE lock for a
-- full table scan (blocking writes); validate in a separate, lighter step.
ALTER TABLE event_share_links
  ADD CONSTRAINT event_share_links_share_method_check
  CHECK (share_method IN ('native', 'clipboard', 'qr')) NOT VALID;

ALTER TABLE event_share_links
  VALIDATE CONSTRAINT event_share_links_share_method_check;
