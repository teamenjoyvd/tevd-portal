-- Migration: add is_all_day column to calendar_events
-- All-day events synced from Google Calendar need a flag so the client
-- can suppress time-grid positioning and show "All day" labels instead.
-- Existing rows default to false (correct — all previously stored events
-- are timed events; all-day events were being stored incorrectly and will
-- be corrected on the next sync run after the edge function is deployed).

ALTER TABLE calendar_events
  ADD COLUMN is_all_day boolean NOT NULL DEFAULT false;
