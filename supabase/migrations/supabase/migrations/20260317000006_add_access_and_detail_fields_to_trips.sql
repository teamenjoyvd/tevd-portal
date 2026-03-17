-- ISS-0048: add per-item access control + detail fields to trips
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS visibility_roles  text[]  NOT NULL DEFAULT '{guest,member,core,admin}',
  ADD COLUMN IF NOT EXISTS location          text,
  ADD COLUMN IF NOT EXISTS accommodation_type text,
  ADD COLUMN IF NOT EXISTS inclusions        text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trip_type         text;

-- Backfill existing rows
UPDATE trips SET visibility_roles = '{guest,member,core,admin}' WHERE visibility_roles IS NULL;
