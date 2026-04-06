-- SEQ343: backfill any calendar_events rows with null/empty visibility_roles
-- and add a column default so future manual inserts are safe.
-- Pre-check showed 0 rows currently need backfill, but the default and
-- the belt-and-suspenders update are both worth having.

UPDATE calendar_events
SET visibility_roles = ARRAY['admin', 'core', 'member', 'guest']::user_role[]
WHERE visibility_roles IS NULL OR visibility_roles = '{}';

ALTER TABLE calendar_events
ALTER COLUMN visibility_roles SET DEFAULT ARRAY['admin', 'core', 'member', 'guest']::user_role[];
