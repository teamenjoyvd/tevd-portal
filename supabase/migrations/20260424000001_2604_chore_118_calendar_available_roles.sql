-- 2604-CHORE-118: Add available_roles to calendar_events
-- allow_guest_registration and meeting_url already exist from prior migrations.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS available_roles text[] NOT NULL DEFAULT '{HOST,SPEAKER,PRODUCTS}';

-- Backfill existing rows (already defaulted above, but be explicit)
UPDATE calendar_events
  SET available_roles = '{HOST,SPEAKER,PRODUCTS}'
  WHERE available_roles IS NULL OR available_roles = '{}';
