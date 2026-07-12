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

-- Deny-all posture: RLS enabled with no policies. All app reads/writes of
-- settings go through the server-side service-role client (bypasses RLS);
-- anon/authenticated must not reach it via the Data API. Idempotent.
-- (Prod's admin policies are added by 20260712000200 — forward-fix, #555.)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

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
