-- ── GCR fixes for event_share_links (PR #262) ────────────────────────────
-- Applied as a follow-on migration because 20260504000001 is already live.

-- 1. Enable RLS on event_share_links (deny-all posture; policies added per feature need)
ALTER TABLE event_share_links ENABLE ROW LEVEL SECURITY;

-- 2. Drop redundant profile index — covered by UNIQUE (profile_id, event_id)
DROP INDEX IF EXISTS idx_event_share_links_profile;

-- 3. Fix SECURITY DEFINER search_path to prevent search path hijacking
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

-- 4. Drop redundant guest_registrations_event_id_idx — covered by UNIQUE (event_id, email)
DROP INDEX IF EXISTS guest_registrations_event_id_idx;
