-- ISS-0057: Calendar event notifications — Core creator fan-down + fan-up

-- 1. Add created_by to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN created_by uuid DEFAULT NULL
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. notify_calendar_event_created trigger function
CREATE OR REPLACE FUNCTION public.notify_calendar_event_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_role  text;
  v_creator_name  text;
  v_creator_path  ltree;
  v_event_date    text;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;

  SELECT role, first_name || ' ' || last_name
    INTO v_creator_role, v_creator_name
    FROM public.profiles WHERE id = NEW.created_by;

  IF v_creator_role IS DISTINCT FROM 'core' THEN RETURN NEW; END IF;

  v_event_date := to_char(NEW.start_time AT TIME ZONE 'Europe/Sofia', 'DD Mon YYYY');

  SELECT path INTO v_creator_path
    FROM public.tree_nodes WHERE profile_id = NEW.created_by;

  -- Fan-down: descendants whose role is in visibility_roles
  IF v_creator_path IS NOT NULL THEN
    INSERT INTO public.notifications (profile_id, type, title, message, action_url)
    SELECT DISTINCT p.id, 'event_fetched',
      'New event in your network',
      NEW.title || ' — ' || v_event_date,
      '/calendar'
    FROM public.tree_nodes tn_desc
    JOIN public.profiles p ON p.id = tn_desc.profile_id
    WHERE tn_desc.path <@ v_creator_path
      AND tn_desc.path::text != v_creator_path::text
      AND p.id != NEW.created_by
      AND p.role = ANY(NEW.visibility_roles);
  END IF;

  -- Fan-up: Core ancestors
  INSERT INTO public.notifications (profile_id, type, title, message, action_url)
  SELECT anc_id, 'event_fetched',
    'Event created in your network',
    v_creator_name || ' created ' || NEW.title || ' — ' || v_event_date,
    '/calendar'
  FROM public.get_core_ancestors(NEW.created_by) AS anc_id
  WHERE anc_id != NEW.created_by;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.calendar_events;
CREATE TRIGGER on_calendar_event_created
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION notify_calendar_event_created();
