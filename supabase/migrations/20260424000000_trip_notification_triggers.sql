-- Extend notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'trip_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'trip_attachment';

-- ── notify_trip_message ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trip_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_title text;
BEGIN
  SELECT title INTO v_trip_title
  FROM public.trips
  WHERE id = NEW.trip_id;

  INSERT INTO public.notifications (profile_id, type, title, message, action_url)
  SELECT
    tr.profile_id,
    'trip_message'::public.notification_type,
    'New trip message',
    v_trip_title || ' — a new message has been posted.',
    '/trips/' || NEW.trip_id::text
  FROM public.trip_registrations tr
  WHERE tr.trip_id = NEW.trip_id
    AND tr.status = 'approved'
    AND tr.profile_id <> NEW.created_by;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_notify_trip_message
AFTER INSERT ON public.trip_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_message();

-- ── notify_trip_attachment ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trip_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_title text;
BEGIN
  SELECT title INTO v_trip_title
  FROM public.trips
  WHERE id = NEW.trip_id;

  INSERT INTO public.notifications (profile_id, type, title, message, action_url)
  SELECT
    tr.profile_id,
    'trip_attachment'::public.notification_type,
    'New trip file',
    v_trip_title || ' — ' || NEW.file_name || ' has been uploaded.',
    '/trips/' || NEW.trip_id::text
  FROM public.trip_registrations tr
  WHERE tr.trip_id = NEW.trip_id
    AND tr.status = 'approved'
    AND tr.profile_id <> NEW.created_by;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_notify_trip_attachment
AFTER INSERT ON public.trip_attachments
FOR EACH ROW EXECUTE FUNCTION public.notify_trip_attachment();
