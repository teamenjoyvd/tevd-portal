-- =============================================================================
-- Migration: 20260514_002_reminder_config.sql
-- Purpose:
--   1) Seed settings rows for global reminder toggles
--   2) Add reminders_enabled column to calendar_events
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1: Global reminder toggle settings
--    Insert only if not already present (idempotent).
-- ---------------------------------------------------------------------------
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
