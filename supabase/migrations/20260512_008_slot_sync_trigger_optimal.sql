-- 2605-CHORE-336 optimal: trigger as integrity backstop, not just convenience sync
-- The route owns the UX contract (409 + human message).
-- The trigger owns the integrity contract — no divergence is possible on any
-- write path (UI, direct SQL, bulk tooling, future routes).
--
-- On INSERT or UPDATE OF available_roles:
--   1. Upsert slots for every label in NEW.available_roles.
--   2. Check for blocked removals BEFORE deleting — if any slot being removed
--      has an active request, RAISE EXCEPTION to roll back the transaction.
--   3. Delete all remaining slots not in NEW.available_roles.

CREATE OR REPLACE FUNCTION public.sync_event_role_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_new_roles text[] := COALESCE(NEW.available_roles, '{}');
BEGIN
  -- 1. Ensure every role in the new array has a slot row
  INSERT INTO public.event_role_slots (event_id, role_label)
  SELECT NEW.id, label
  FROM unnest(v_new_roles) AS label
  ON CONFLICT (event_id, role_label) DO NOTHING;

  -- 2. Guard: if any slot being removed has an active request, abort.
  --    Rolls back the calendar_events UPDATE too — no divergence possible.
  --    The route-level 409 guard handles the normal UI path; this catches
  --    everything else (direct SQL, bulk tooling, future routes).
  IF EXISTS (
    SELECT 1
    FROM public.event_role_slots s
    JOIN public.event_role_requests r
      ON r.event_id   = s.event_id
     AND r.role_label = s.role_label
    WHERE s.event_id        = NEW.id
      AND s.role_label     <> ALL(v_new_roles)
      AND r.status          IN ('pending', 'approved')
  ) THEN
    RAISE EXCEPTION 'Cannot remove role(s) with active requests'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3. Delete all slots no longer in available_roles
  DELETE FROM public.event_role_slots
  WHERE event_id   = NEW.id
    AND role_label <> ALL(v_new_roles);

  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_sync_event_role_slots ON public.calendar_events;

CREATE TRIGGER trg_sync_event_role_slots
  AFTER INSERT OR UPDATE OF available_roles
  ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_role_slots();
