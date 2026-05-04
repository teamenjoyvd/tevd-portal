-- ── event_share_links ──────────────────────────────────────────────────────
-- One share link per member per event. Token is unique and url-safe.
-- share_method records how the link was last shared ('native' | 'clipboard').

CREATE TABLE IF NOT EXISTS event_share_links (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id     uuid        NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  token        text        NOT NULL UNIQUE,
  share_method text        NOT NULL CHECK (share_method IN ('native', 'clipboard')),
  click_count  integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, event_id)
);

CREATE INDEX idx_event_share_links_profile ON event_share_links (profile_id);
CREATE INDEX idx_event_share_links_event   ON event_share_links (event_id);

-- ── increment_share_link_click RPC ────────────────────────────────────────
-- Atomic counter increment. Called on guest registration — never on page load.
-- Uses UPDATE directly to avoid read-then-write race conditions.

CREATE OR REPLACE FUNCTION increment_share_link_click(link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE event_share_links
  SET    click_count = click_count + 1
  WHERE  id = link_id;
$$;

-- ── guest_registrations additions ─────────────────────────────────────────

ALTER TABLE guest_registrations
  ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES event_share_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attended_at   timestamptz;

-- Unique constraint on (event_id, email) enables safe upsert deduplication.
-- Verified: zero duplicate rows in prod before applying.
ALTER TABLE guest_registrations
  ADD CONSTRAINT guest_registrations_event_email_unique UNIQUE (event_id, email);

DROP INDEX IF EXISTS guest_registrations_event_id_idx;

CREATE INDEX idx_guest_reg_share_link ON guest_registrations (share_link_id)
  WHERE share_link_id IS NOT NULL;
