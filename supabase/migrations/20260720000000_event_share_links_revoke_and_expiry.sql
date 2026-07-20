-- ROLLBACK: ALTER TABLE event_share_links DROP COLUMN revoked_at;

-- ── event_share_links.revoked_at ──────────────────────────────────────────
-- Soft-revoke marker. NULL = active. Additive/nullable, safe alongside the
-- currently deployed code (expand step).

ALTER TABLE event_share_links
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_event_share_links_revoked_at
  ON event_share_links (revoked_at)
  WHERE revoked_at IS NOT NULL;

-- ── guest_registrations.expires_at backfill ───────────────────────────────
-- One-off correction: registrations for events that haven't happened yet
-- get their expiry rebased to event.end_time + 3h (replaces the old
-- hardcoded 72h-from-registration rule going forward). Past events are left
-- untouched — their registrations have already served their purpose.

UPDATE guest_registrations gr
SET    expires_at = ce.end_time + interval '3 hours'
FROM   calendar_events ce
WHERE  gr.event_id = ce.id
  AND  ce.end_time > now();
