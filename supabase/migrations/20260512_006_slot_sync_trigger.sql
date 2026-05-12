-- 2605-CHORE-336: Atomic slot sync on calendar_events.available_roles update
-- Moves the upsert/delete slot mechanics out of the PATCH route and into a
-- trigger so that slot mutations are atomic with the calendar_events UPDATE.
-- The 409 guard (active request check) remains in the route.

CREATE OR REPLACE FUNCTION public.sync_event_role_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_added   text[];
  v_removed text[];
  v_label   text;
  v_blocked boolean;
BEGIN
  -- Compute diff between old and new available_roles arrays
  SELECT
    array(
      SELECT unnest(COALESCE(NEW.available_roles, '{}'))
      EXCEPT
      SELECT unnest(COALESCE(OLD.available_roles, '{}'))
    ),
    array(
      SELECT unnest(COALESCE(OLD.available_roles, '{}'))
      EXCEPT
      SELECT unnest(COALESCE(NEW.available_roles, '{}'))
    )
  INTO v_added, v_removed;

  -- Upsert slots for newly added labels
  IF array_length(v_added, 1) > 0 THEN
    INSERT INTO public.event_role_slots (event_id, role_label)
    SELECT NEW.id, label
    FROM unnest(v_added) AS label
    ON CONFLICT (event_id, role_label) DO NOTHING;
  END IF;

  -- Delete open slots for removed labels only when no active requests exist
  IF array_length(v_removed, 1) > 0 THEN
    FOREACH v_label IN ARRAY v_removed LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.event_role_requests
        WHERE event_id  = NEW.id
          AND role_label = v_label
          AND status IN ('pending', 'approved')
      ) INTO v_blocked;

      IF NOT v_blocked THEN
        DELETE FROM public.event_role_slots
        WHERE event_id  = NEW.id
          AND role_label = v_label;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to make this migration idempotent
DROP TRIGGER IF EXISTS trg_sync_event_role_slots ON public.calendar_events;

CREATE TRIGGER trg_sync_event_role_slots
  AFTER UPDATE OF available_roles
  ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_role_slots();
