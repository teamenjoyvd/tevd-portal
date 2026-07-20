-- ROLLBACK: DROP INDEX IF EXISTS idx_event_share_links_active_unique; ALTER TABLE event_share_links ADD CONSTRAINT event_share_links_profile_id_event_id_key UNIQUE (profile_id, event_id);

-- The original (profile_id, event_id) unique constraint forced revoke+remint to
-- overwrite the same row (upsert), which destroyed the revoked link's history:
-- the old token stopped resolving (so a guest clicking it silently fell through
-- to "unknown token" instead of "revoked") and any guest already attributed to
-- it flipped back from 'cancelled' to 'pending' once revoked_at was cleared.
-- Replace it with a partial unique index scoped to active (non-revoked) links
-- only, so a member can still have at most one ACTIVE link per event, but
-- revoked links persist as their own rows.

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT tc.constraint_name INTO c_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'event_share_links'
    AND tc.constraint_type = 'UNIQUE'
  GROUP BY tc.constraint_name
  HAVING array_agg(kcu.column_name::text ORDER BY kcu.column_name) = ARRAY['event_id', 'profile_id'];

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE event_share_links DROP CONSTRAINT %I', c_name);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_share_links_active_unique
  ON event_share_links (profile_id, event_id)
  WHERE revoked_at IS NULL;
