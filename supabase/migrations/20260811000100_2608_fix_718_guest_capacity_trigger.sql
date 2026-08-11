-- ROLLBACK: DROP TRIGGER IF EXISTS trg_enforce_event_guest_capacity ON public.guest_registrations;
--           DROP FUNCTION IF EXISTS public.enforce_event_guest_capacity();
-- ============================================================
-- [2608-DEV-718] guest_capacity: close the check-then-write race
--
-- `calendar_events.guest_capacity` (20260720000300) has never had anything
-- backing it in the database — no trigger, no constraint, no index. Every
-- writer counted active registrations in application code and then wrote:
--
--   lib/actions/guest-registration.ts   (guest form)
--   lib/server/member-registration.ts   (member one-tap attend)
--   approve_event_role_request()        (20260811000000, role approval)
--   e2e specs and scripts/seed-guest-test-user.js (direct inserts)
--
-- Nothing holds between the count and the write, so two registrations landing
-- near the limit both read a count below capacity and both commit. The cap is
-- meant to be hard (it usually mirrors a physical venue limit), and the
-- overbooking is silent — no error surfaces to the guest or to an admin.
--
-- WHY A TRIGGER AND NOT THE RPC THE ISSUE SUGGESTED: #718 proposed folding the
-- count and the write into one SECURITY DEFINER RPC shared by the two call
-- sites it knew about. That list was already out of date — #710 added a fourth
-- writer inside another PL/pgSQL function. An RPC would have to absorb the
-- guest token-reuse decision, the member adopt-or-insert branch, AND be
-- re-entrant from inside approve_event_role_request. A trigger sits under all
-- of them, including the direct inserts in the e2e specs and any writer added
-- later, and cannot be defeated by forgetting to call it — which is what the
-- issue actually asked for ("share one code path so this can't drift out of
-- sync again").
--
-- WHY THE COUNT IS TRUSTWORTHY: identical reasoning to consume_rate_limit
-- (20260804000000_2608_feat_625_atomic_rate_limits.sql). pg_advisory_xact_lock
-- serializes concurrent writers for THIS event and releases on commit, and a
-- VOLATILE function -- which every trigger function is -- takes a fresh
-- snapshot at the start of each query it executes. So the count below runs
-- after the lock is granted and sees the row the transaction ahead of us just
-- committed. A stale-snapshot count is what would let the second writer
-- through, and that is precisely what does not happen here.
--
-- The application-level checks in guest-registration.ts and
-- member-registration.ts deliberately STAY. They are the fast path that
-- produces the friendly localized "event is full" copy; this trigger is the
-- backstop for the narrow window they cannot cover, and its SQLSTATE is mapped
-- back onto the same message (lib/server/event-capacity.ts isCapacityViolation).
--
-- SECURITY DEFINER with no internal auth guard, unlike the rule in
-- docs/ai/GOTCHAS.md ("Trusted RPC + service role"): that rule exists because a
-- SECURITY DEFINER function is directly callable and bypasses RLS. This one is
-- not callable at all -- Postgres refuses to invoke a function returning
-- `trigger` outside a trigger context -- so there is no caller to authorize.
-- DEFINER is used only so the counts below are computed over every row rather
-- than the invoking role's RLS-filtered view, which could otherwise under-count
-- and let a registration past the cap. EXECUTE is deliberately NOT revoked:
-- privileges on a trigger function are checked when the trigger is created, and
-- revoking would risk the write paths, for no gain given the above.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_event_guest_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_active   integer;
BEGIN
  -- A cancelled row occupies no seat.
  IF NEW.cancelled_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only a row that BECOMES active can grow the headcount. A row already
  -- active on this same event is being edited, not seated: the join page's
  -- attended_at stamp (app/events/[eventId]/join/page.tsx:133,191), the guest
  -- form's name/attribution refresh, and registerGuest's upsert re-writing
  -- cancelled_at = NULL over an already-NULL value all land here and must not
  -- be refused on a full event.
  --
  -- ...but "already active" is not the same as "already counted". The count
  -- below excludes approved role holders, so an active row's seat is occupied
  -- or exempt depending on its profile_id. An UPDATE that moved profile_id from
  -- an approved holder to anyone else would flip the row from exempt to
  -- occupied — growing the headcount by one — while still satisfying the two
  -- conditions above and returning here unchecked (CodeRabbit, PR #732).
  --
  -- No writer in this repo can do that today: every write that sets profile_id
  -- requires the pre-image to be NULL (lib/server/member-registration.ts:255
  -- `.is('profile_id', null)`, 20260811000000:112 `g.profile_id IS NULL`), and
  -- registerGuest's upsert never names the column at all. NULL -> non-NULL only
  -- ever moves a row toward exempt, which under-counts and cannot overbook.
  -- The third condition is therefore unreachable as written — and that is
  -- exactly why it belongs here. This trigger exists so the cap survives a
  -- writer nobody has written yet; leaving the gap open because the current
  -- four callers happen to avoid it would rest the guarantee on the same
  -- audit-every-caller discipline the trigger was built to replace.
  --
  -- Any profile_id change on an active row falls through to the full check
  -- instead. That is safe for the adopt paths that do reach it: `gr.id <>
  -- NEW.id` excludes the row's own already-counted seat from v_active, so
  -- adopting the last guest on an exactly-full event still passes.
  IF TG_OP = 'UPDATE'
     AND OLD.cancelled_at IS NULL
     AND OLD.event_id = NEW.event_id
     AND OLD.profile_id IS NOT DISTINCT FROM NEW.profile_id THEN
    RETURN NEW;
  END IF;

  SELECT guest_capacity INTO v_capacity
    FROM public.calendar_events
   WHERE id = NEW.event_id;

  -- NULL = unlimited (20260720000300). Short-circuits before the lock, so
  -- events without a cap pay nothing and never serialize.
  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Approved role holders are staff, not attendees (2608-DEV-710 D10, mirrored
  -- in lib/server/event-capacity.ts). Their seat is exempt in both directions:
  -- exempt here so a HOST approval is never refused for capacity, and excluded
  -- from the count below so a well-staffed event cannot lock out the guests it
  -- exists to attract. approve_event_role_request sets status = 'approved'
  -- (20260811000000:55-58) BEFORE its registration write, so this sees it.
  IF NEW.profile_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.event_role_requests err
     WHERE err.event_id   = NEW.event_id
       AND err.profile_id = NEW.profile_id
       AND err.status     = 'approved'
  ) THEN
    RETURN NEW;
  END IF;

  -- Serializes writers for this event only; released on commit. A hashtext
  -- collision with an unrelated key costs a little serialization and nothing
  -- else -- the count is still filtered by event_id.
  PERFORM pg_advisory_xact_lock(hashtext('event-capacity:' || NEW.event_id::text));

  SELECT count(*) INTO v_active
    FROM public.guest_registrations gr
   WHERE gr.event_id     = NEW.event_id
     AND gr.cancelled_at IS NULL
     -- BEFORE INSERT: the row is not in the table yet, so this is a no-op.
     -- BEFORE UPDATE: load-bearing when a row moves between events, where the
     -- pre-image is still active on the row being counted.
     AND gr.id <> NEW.id
     AND NOT EXISTS (
       SELECT 1
         FROM public.event_role_requests err
        WHERE err.event_id   = gr.event_id
          AND err.profile_id = gr.profile_id
          AND err.status     = 'approved'
     );

  IF v_active >= v_capacity THEN
    -- Custom SQLSTATE, not one of the 23xxx integrity codes: this table already
    -- carries real CHECK and UNIQUE constraints (guest_registrations_guest_xor_
    -- member_chk, guest_registrations_event_profile_uniq), and a caller that
    -- matched on a shared class would report an unrelated violation as "event
    -- full". P0718 is in the PL/pgSQL class (P0000-P0004 are the assigned ones)
    -- and is matched verbatim by isCapacityViolation.
    RAISE EXCEPTION 'Event % has reached its guest capacity (%)', NEW.event_id, v_capacity
      USING ERRCODE = 'P0718';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_event_guest_capacity() IS
  '2608-DEV-718: hard-enforces calendar_events.guest_capacity at write time. Raises SQLSTATE P0718 when the event is full. Approved event_role_requests holders are exempt and excluded from the count (2608-DEV-710 D10).';

CREATE TRIGGER trg_enforce_event_guest_capacity
  BEFORE INSERT OR UPDATE ON public.guest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_guest_capacity();
