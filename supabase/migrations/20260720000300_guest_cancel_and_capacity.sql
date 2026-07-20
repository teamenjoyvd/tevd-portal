-- =============================================================================
-- Migration: 20260720000300_guest_cancel_and_capacity.sql
-- Description: Guest self-cancel (soft-cancel, row kept for stats) + per-event
--              guest capacity cap (NULL = unlimited). 2607-DEV-590.
-- ROLLBACK: ALTER TABLE public.guest_registrations DROP COLUMN cancelled_at; ALTER TABLE public.calendar_events DROP COLUMN guest_capacity;
-- =============================================================================

ALTER TABLE public.guest_registrations
  ADD COLUMN cancelled_at timestamptz NULL;

ALTER TABLE public.calendar_events
  ADD COLUMN guest_capacity integer NULL;

COMMENT ON COLUMN public.guest_registrations.cancelled_at IS 'Guest self-cancel ("can''t attend") timestamp. Row is kept for stats; cancelled registrations are excluded from capacity counts and skip reminders.';
COMMENT ON COLUMN public.calendar_events.guest_capacity IS 'Max non-cancelled guest registrations for this event. NULL = unlimited.';
