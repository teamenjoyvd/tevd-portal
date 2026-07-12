-- =============================================================================
-- Migration: 20260514_002_reminder_config.sql
-- Purpose:
--   1) Seed settings rows for global reminder toggles
--   2) Add reminders_enabled column to calendar_events
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1: Global reminder toggle settings
--    Insert only if not already present (idempotent).
--    Guarded (#547): public.settings exists in prod but is created by no
--    migration (schema drift) — create it on fresh replays so this insert works.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settings (
  key        text        PRIMARY KEY,
  value      jsonb       NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.settings (key, value)
VALUES
  ('reminders_1hr_enabled',  '"true"'),
  ('reminders_15min_enabled', '"true"')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2: Per-event reminder toggle
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;
