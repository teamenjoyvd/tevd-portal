-- 2605-CHORE-336 GCR fixes: replace diff-based logic with full NEW-array sync
-- Changes from 006:
--   1. Trigger now fires on INSERT OR UPDATE so new events seed their slots.
--   2. INSERT step syncs all labels in NEW.available_roles (not just added ones)
--      — handles ghost slots and INSERT events in one pass.
--   3. DELETE step removes all slots not in NEW.available_roles, skipping rows
--      that have active (pending/approved) requests (route-level 409 is the
--      user-facing guard; trigger skip is belt-and-suspenders for direct writes).
--   4. Procedural FOREACH loop replaced with a single set-based DELETE.
--   5. Unused DECLARE variables removed.

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

  -- 2. Remove slots that are no longer in available_roles, provided they have
  --    no active requests. Slots with pending/approved requests are skipped
  --    silently — the route-level 409 guard prevents this path for normal
  --    UI flows; the skip here protects against direct DB writes / race edges.
  DELETE FROM public.event_role_slots
  WHERE event_id = NEW.id
    AND role_label <> ALL(v_new_roles)
    AND NOT EXISTS (
      SELECT 1
      FROM public.event_role_requests r
      WHERE r.event_id   = NEW.id
        AND r.role_label = event_role_slots.role_label
        AND r.status IN ('pending', 'approved')
    );

  RETURN NEW;
END;
$$;

-- Recreate trigger to fire on both INSERT and UPDATE OF available_roles
DROP TRIGGER IF EXISTS trg_sync_event_role_slots ON public.calendar_events;

CREATE TRIGGER trg_sync_event_role_slots
  AFTER INSERT OR UPDATE OF available_roles
  ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_role_slots();
