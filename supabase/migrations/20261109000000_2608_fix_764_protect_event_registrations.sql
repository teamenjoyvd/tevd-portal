-- ROLLBACK: DROP FUNCTION IF EXISTS public.admin_delete_event_with_registrations(uuid);
--           ALTER TABLE public.guest_registrations DROP CONSTRAINT guest_registrations_event_id_fkey;
--           ALTER TABLE public.guest_registrations
--             ADD CONSTRAINT guest_registrations_event_id_fkey FOREIGN KEY (event_id)
--             REFERENCES public.calendar_events(id) ON DELETE CASCADE;
--           ALTER TABLE public.calendar_events DROP COLUMN source;
--           DROP TYPE public.calendar_event_source;
-- ============================================================
-- [2608-DEV-764] A calendar event can no longer take its registrations with it
--
-- Two independent protections. Either one alone would have prevented the data
-- loss; both are here because they fail in different directions.
--
-- 1. `calendar_events.source` — the Google sync reconciles its window by
--    deleting rows Google did not return
--    (supabase/functions/sync-google-calendar/index.ts). Once #774 imports Zoom
--    sessions into this same table, every one of those rows is a row Google
--    will never return, so reconciliation would delete the entire Zoom series
--    on its next run. `source` is what the sync filters on: it only ever
--    considers its own rows.
--
--    Existing rows all come from Google, so the default backfills them
--    correctly and no UPDATE is needed. The column is NOT NULL with a default,
--    which is additive: the currently deployed sync does not set `source` on
--    insert and gets 'google', which is what it means.
--
-- 2. `guest_registrations_event_id_fkey` CASCADE -> RESTRICT — the cascade is
--    what turned "an event left the sync window" into "every registration for
--    it is gone", with no warning and nothing to restore from. RESTRICT makes
--    the database refuse, so the failure is loud and the data survives.
--
--    This is deliberately the ONLY FK changed. The other four cascading
--    children of calendar_events are derived or admin-configured rows that
--    carry no member-entered data and are meaningless without their event:
--      notification_queue   (20260705000200) — generated reminder jobs
--      scheduled_reminders  (20260513000100) — generated reminder schedule
--      event_share_links    (20260504000001) — admin-created invite links
--      event_role_slots     (20260512000200) — admin-configured slots
--    They keep ON DELETE CASCADE. `event_role_requests` (baseline.sql:158) is
--    member data and already has no delete action, i.e. it already blocks —
--    this change makes guest_registrations consistent with it rather than
--    inventing a new rule.
--
-- WHY NOT SOFT DELETE: considered and rejected for scope. A `deleted_at` on
-- calendar_events would need a filter on every read path — the member and admin
-- calendar queries, get_event_registrations_for_viewer, the RLS policies and the
-- ICS feed — and one missed site shows deleted events to members. RESTRICT puts
-- the guarantee in one place that cannot be forgotten.
--
-- A RESTRICT violation raises SQLSTATE 23503 (foreign_key_violation). Callers
-- that delete events must clear children first or surface it:
-- app/api/admin/calendar/[id]/route.ts refuses with a count before it tries.
-- ============================================================

CREATE TYPE public.calendar_event_source AS ENUM ('google', 'zoom', 'portal');

ALTER TABLE public.calendar_events
  ADD COLUMN source public.calendar_event_source NOT NULL DEFAULT 'google';

COMMENT ON COLUMN public.calendar_events.source IS
  'Who owns this row. google = created and reconciled by sync-google-calendar, the only source it may delete. zoom = imported from a linked Zoom series (2611-DEV-774). portal = created in the admin EventForm. The Google sync must filter on source = ''google'' for every write and every delete.';

-- Partial index: the sync filters on source='google' on every run, and the
-- non-google rows are the ones that must never be scanned into a delete set.
CREATE INDEX calendar_events_google_source_idx
  ON public.calendar_events (source)
  WHERE source = 'google';

ALTER TABLE public.guest_registrations
  DROP CONSTRAINT guest_registrations_event_id_fkey;

ALTER TABLE public.guest_registrations
  ADD CONSTRAINT guest_registrations_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE RESTRICT;

COMMENT ON CONSTRAINT guest_registrations_event_id_fkey ON public.guest_registrations IS
  'RESTRICT, not CASCADE (2608-DEV-764). Deleting an event that has registrations — including cancelled ones, which are kept for stats — must fail loudly rather than destroy them silently. guest_registrations_event_id_idx backs the check.';

-- ============================================================
-- The deliberate way through the RESTRICT.
--
-- With the cascade gone, an admin who genuinely wants to delete an event that
-- has registrations has no path at all: nothing in the app deletes a
-- guest_registrations row, and `cancelled_at` does not remove it, so the FK
-- keeps refusing. The admin DELETE route therefore refuses with 409 by
-- default and calls this function only when the admin confirms.
--
-- It exists as one function because the two deletes must be one transaction.
-- supabase-js cannot span statements, so doing this from the route would leave
-- a window where the registrations are destroyed and the event survives —
-- precisely the data loss this migration is about, only narrower.
--
-- Returns the number of registrations deleted, so the route can report it.
-- Any RAISE below rolls back both deletes.
--
-- The guard is strict, so a plain psql session cannot call this (auth.role()
-- is NULL there). To run it by hand, arrive as the real caller does:
--   SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
--   SELECT public.admin_delete_event_with_registrations('<event-uuid>');
-- in one transaction.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_event_with_registrations(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Service role only. PostgREST would otherwise expose this to any signed-in
  -- member through /rest/v1/rpc.
  --
  -- IS DISTINCT FROM, not <>: auth.role() is NULL on a session with no JWT
  -- claims (a direct psql connection), and `NULL <> 'service_role'` is NULL,
  -- which IF treats as false — the guard would fail open. Verified by probe
  -- before this was written. Matches the form in 20260705000700_notification_rpcs.sql.
  --
  -- The REVOKEs below are NOT load-bearing: the Supabase stack re-grants
  -- EXECUTE on public functions to anon and authenticated after migrations
  -- run (every existing Pattern A helper carries those grants too), so this
  -- in-body check is the only real gate. The REVOKEs stay as declared intent.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'admin_delete_event_with_registrations is service_role only';
  END IF;

  DELETE FROM public.guest_registrations WHERE event_id = p_event_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.calendar_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    -- No event with that id: refuse rather than silently report success, and
    -- roll back the registration deletion we just did.
    RAISE EXCEPTION 'event % not found', p_event_id;
  END IF;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_event_with_registrations(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_event_with_registrations(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_event_with_registrations(uuid) FROM authenticated;

COMMENT ON FUNCTION public.admin_delete_event_with_registrations(uuid) IS
  'Deletes an event together with its registrations, in one transaction (2608-DEV-764). The only sanctioned way past guest_registrations_event_id_fkey. Service role only; called by app/api/admin/calendar/[id] DELETE after the admin confirms the 409. Returns the registration count deleted.';
