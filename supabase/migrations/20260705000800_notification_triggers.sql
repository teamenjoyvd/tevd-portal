-- =============================================================================
-- Migration: 20260705000800_notification_triggers.sql
-- Description: Redefines guest reminder triggers and retargets baseline triggers to member_notifications.
-- =============================================================================

-- Drop old triggers and functions for guest reminders
DROP TRIGGER IF EXISTS trg_schedule_guest_reminders ON public.guest_registrations;
DROP TRIGGER IF EXISTS trg_reschedule_guest_reminders ON public.calendar_events;
DROP FUNCTION IF EXISTS public.fn_schedule_guest_reminders();
DROP FUNCTION IF EXISTS public.fn_reschedule_guest_reminders();
DROP FUNCTION IF EXISTS public.fn_schedule_guest_reminders_record(uuid, timestamptz, text);

-- Helper function to schedule reminders for a single guest registration
CREATE OR REPLACE FUNCTION public.fn_schedule_guest_reminders_record(
  p_registration_id uuid,
  p_start_time timestamptz,
  p_event_title text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest RECORD;
  v_reminders_enabled boolean;
  v_1h_enabled boolean;
  v_15m_enabled boolean;
BEGIN
  -- Fetch guest info
  SELECT email, name, event_id INTO v_guest FROM public.guest_registrations WHERE id = p_registration_id;
  IF v_guest IS NULL THEN
    RETURN;
  END IF;

  -- Fetch event reminders_enabled
  SELECT reminders_enabled INTO v_reminders_enabled FROM public.calendar_events WHERE id = v_guest.event_id;
  IF NOT coalesce(v_reminders_enabled, true) THEN
    RETURN;
  END IF;

  -- Fetch global settings (stored as JSON, e.g. '"true"' or '"false"')
  SELECT (value::jsonb = '"true"'::jsonb) INTO v_1h_enabled
  FROM public.settings
  WHERE key = 'reminders_1hr_enabled';

  SELECT (value::jsonb = '"true"'::jsonb) INTO v_15m_enabled
  FROM public.settings
  WHERE key = 'reminders_15min_enabled';

  -- Enqueue 1h reminder if globally enabled
  IF coalesce(v_1h_enabled, true) THEN
    INSERT INTO public.notification_queue (
      registration_id, event_id, type, channel, status, payload, send_at, attempts, max_attempts
    ) VALUES (
      p_registration_id, v_guest.event_id, 'event_reminder_1h'::public.notification_queue_type,
      'email'::public.notification_channel, 'pending',
      jsonb_build_object('email', v_guest.email, 'name', v_guest.name, 'event_title', p_event_title),
      p_start_time - INTERVAL '1 hour', 0, 3
    ) ON CONFLICT (registration_id, type) DO UPDATE SET
      status = 'pending', attempts = 0, send_at = EXCLUDED.send_at, payload = EXCLUDED.payload;
  END IF;

  -- Enqueue 15m reminder if globally enabled
  IF coalesce(v_15m_enabled, true) THEN
    INSERT INTO public.notification_queue (
      registration_id, event_id, type, channel, status, payload, send_at, attempts, max_attempts
    ) VALUES (
      p_registration_id, v_guest.event_id, 'event_reminder_15m'::public.notification_queue_type,
      'email'::public.notification_channel, 'pending',
      jsonb_build_object('email', v_guest.email, 'name', v_guest.name, 'event_title', p_event_title),
      p_start_time - INTERVAL '15 minutes', 0, 3
    ) ON CONFLICT (registration_id, type) DO UPDATE SET
      status = 'pending', attempts = 0, send_at = EXCLUDED.send_at, payload = EXCLUDED.payload;
  END IF;
END;
$$;

-- Redefine public.fn_schedule_guest_reminders()
CREATE OR REPLACE FUNCTION public.fn_schedule_guest_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
  v_event_title text;
BEGIN
  -- Delete existing pending/failed reminders for safety if status changes
  DELETE FROM public.notification_queue
  WHERE registration_id = NEW.id
    AND status IN ('pending', 'failed');

  -- If status is confirmed
  IF NEW.status = 'confirmed' THEN
    -- Fetch event configurations
    SELECT start_time, title
    INTO v_start_time, v_event_title
    FROM public.calendar_events
    WHERE id = NEW.event_id;

    IF v_start_time IS NOT NULL THEN
      PERFORM public.fn_schedule_guest_reminders_record(NEW.id, v_start_time, v_event_title);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Redefine public.fn_reschedule_guest_reminders()
CREATE OR REPLACE FUNCTION public.fn_reschedule_guest_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest RECORD;
BEGIN
  -- If reminders_enabled is updated to false, clear pending/failed reminders
  IF NEW.reminders_enabled = false THEN
    DELETE FROM public.notification_queue
    WHERE event_id = NEW.id
      AND status IN ('pending', 'failed');
  
  -- If reminders_enabled changes from false to true, regenerate reminders for all confirmed guests
  ELSIF (OLD.reminders_enabled = false OR OLD.reminders_enabled IS NULL) AND NEW.reminders_enabled = true THEN
    FOR v_guest IN 
      SELECT id, email, name, event_id FROM public.guest_registrations 
      WHERE event_id = NEW.id AND status = 'confirmed'
    LOOP
      -- Reuse the guest schedule logic by invoking it
      -- Note: This will naturally use the NEW start_time and title since the event record is updated
      PERFORM public.fn_schedule_guest_reminders_record(v_guest.id, NEW.start_time, NEW.title);
    END LOOP;

  -- Otherwise, if start_time or title changes, update existing pending/failed reminders
  ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time OR NEW.title IS DISTINCT FROM OLD.title THEN
    UPDATE public.notification_queue
    SET send_at = (
          CASE
            WHEN type = 'event_reminder_1h'::public.notification_queue_type THEN NEW.start_time - INTERVAL '1 hour'
            WHEN type = 'event_reminder_15m'::public.notification_queue_type THEN NEW.start_time - INTERVAL '15 minutes'
          END
        ),
        payload = jsonb_set(payload, '{event_title}', to_jsonb(NEW.title))
    WHERE event_id = NEW.id
      AND status IN ('pending', 'failed');
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach guest reminder triggers
CREATE TRIGGER trg_schedule_guest_reminders
  AFTER INSERT OR UPDATE OF status, email, name
  ON public.guest_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_schedule_guest_reminders();

CREATE TRIGGER trg_reschedule_guest_reminders
  AFTER UPDATE OF start_time, title, reminders_enabled
  ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_reschedule_guest_reminders();

-- Retarget 10 database-trigger notification functions to public.member_notifications

-- 1. notify_trip_created()
CREATE OR REPLACE FUNCTION public.notify_trip_created()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
begin
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  select p.id, 'trip_created', 'New trip available',
    NEW.title || ' — ' || NEW.destination || ' is now open for registration.', '/trips'
  from public.profiles p where p.role in ('member','core','admin');
  return NEW;
end;
$$;

-- 2. notify_trip_request()
CREATE OR REPLACE FUNCTION public.notify_trip_request()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
declare
  v_trip_title text;
  v_member_name text;
begin
  select title into v_trip_title from public.trips where id = NEW.trip_id;
  select first_name || ' ' || last_name into v_member_name from public.profiles where id = NEW.profile_id;
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  select p.id, 'trip_request', 'New trip request',
    v_member_name || ' requested to join ' || v_trip_title, '/admin/approval-hub'
  from public.profiles p where p.role = 'admin';
  return NEW;
end;
$$;

-- 3. notify_registration_status_change()
CREATE OR REPLACE FUNCTION public.notify_registration_status_change()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
declare
  v_trip_title text;
begin
  if OLD.status = NEW.status then return NEW; end if;
  select title into v_trip_title from public.trips where id = NEW.trip_id;
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  values (
    NEW.profile_id, 'trip_request',
    case NEW.status when 'approved' then 'Trip request approved'
      when 'denied' then 'Trip request denied' else 'Trip request updated' end,
    case NEW.status when 'approved' then 'Your request to join ' || v_trip_title || ' has been approved.'
      when 'denied' then 'Your request to join ' || v_trip_title || ' has been declined.'
      else 'Your request for ' || v_trip_title || ' has been updated.' end,
    '/trips'
  );
  return NEW;
end;
$$;

-- 4. notify_role_request()
CREATE OR REPLACE FUNCTION public.notify_role_request()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
declare
  v_event_title text;
  v_member_name text;
begin
  select title into v_event_title from public.calendar_events where id = NEW.event_id;
  select first_name || ' ' || last_name into v_member_name from public.profiles where id = NEW.profile_id;
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  select p.id, 'role_request', 'New role request',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title, '/admin/approval-hub'
  from public.profiles p where p.role = 'admin';
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  select anc_id, 'role_request', 'Role request in your network',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title, '/admin/approval-hub'
  from public.get_core_ancestors(NEW.profile_id) AS anc_id;
  return NEW;
end;
$$;

-- 5. notify_role_request_status_change()
CREATE OR REPLACE FUNCTION public.notify_role_request_status_change()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
declare
  v_event_title text;
begin
  if OLD.status = NEW.status then return NEW; end if;
  select title into v_event_title from public.calendar_events where id = NEW.event_id;
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  values (
    NEW.profile_id, 'role_request',
    case NEW.status when 'approved' then 'Role request approved'
      when 'denied' then 'Role request declined' else 'Role request updated' end,
    case NEW.status when 'approved' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been approved.'
      when 'denied' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been declined.'
      else 'Your role request for ' || v_event_title || ' has been updated.' end,
    '/calendar'
  );
  return NEW;
end;
$$;

-- 6. notify_doc_expiry()
CREATE OR REPLACE FUNCTION public.notify_doc_expiry()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
begin
  if NEW.valid_through is null then return NEW; end if;
  if OLD.valid_through = NEW.valid_through then return NEW; end if;
  if NEW.valid_through <= (current_date + interval '6 months') then
    insert into public.member_notifications (profile_id, type, title, message, action_url)
    values (NEW.id, 'doc_expiry', 'Document expiring soon',
      'Your ' || case NEW.document_active_type when 'passport' then 'passport' else 'national ID' end ||
      ' expires on ' || to_char(NEW.valid_through, 'DD Mon YYYY') || '. Please update your documents.',
      '/profile');
  end if;
  return NEW;
end;
$$;

-- 7. notify_calendar_event_created()
CREATE OR REPLACE FUNCTION public.notify_calendar_event_created()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_creator_role  text;
  v_creator_name  text;
  v_creator_path  ltree;
  v_event_date    text;
BEGIN
  IF NEW.created_by IS NULL THEN RETURN NEW; END IF;
  SELECT role, first_name || ' ' || last_name INTO v_creator_role, v_creator_name
  FROM public.profiles WHERE id = NEW.created_by;
  IF v_creator_role IS DISTINCT FROM 'core' THEN RETURN NEW; END IF;
  v_event_date := to_char(NEW.start_time AT TIME ZONE 'Europe/Sofia', 'DD Mon YYYY');
  SELECT path INTO v_creator_path FROM public.tree_nodes WHERE profile_id = NEW.created_by;
  IF v_creator_path IS NOT NULL THEN
    INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
    SELECT DISTINCT p.id, 'event_fetched', 'New event in your network',
      NEW.title || ' — ' || v_event_date, '/calendar'
    FROM public.tree_nodes tn_desc
    JOIN public.profiles p ON p.id = tn_desc.profile_id
    WHERE tn_desc.path <@ v_creator_path
      AND tn_desc.path::text != v_creator_path::text
      AND p.id != NEW.created_by
      AND p.role = ANY(NEW.visibility_roles);
  END IF;
  INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
  SELECT anc_id, 'event_fetched', 'Event created in your network',
    v_creator_name || ' created ' || NEW.title || ' — ' || v_event_date, '/calendar'
  FROM public.get_core_ancestors(NEW.created_by) AS anc_id
  WHERE anc_id != NEW.created_by;
  RETURN NEW;
END;
$$;

-- 8. notify_verification_request()
CREATE OR REPLACE FUNCTION public.notify_verification_request()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
declare
  v_name text;
begin
  SELECT first_name || ' ' || last_name INTO v_name
  FROM public.profiles WHERE id = NEW.profile_id;
  INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
  SELECT id, 'role_request', 'ABO verification request',
    v_name || ' is requesting verification for ABO ' || NEW.claimed_abo, '/admin/members'
  FROM public.profiles WHERE role = 'admin';
  RETURN NEW;
end;
$$;

-- 9. notify_trip_message()
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

  INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
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

-- 10. notify_trip_attachment()
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

  INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
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

-- Redefine public.run_los_digest() to target public.member_notifications instead of public.notifications
CREATE OR REPLACE FUNCTION public.run_los_digest()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_core       RECORD;
  v_trip_count int;
  v_doc_count  int;
  v_message    text;
BEGIN
  FOR v_core IN
    SELECT id, abo_number FROM public.profiles
    WHERE role = 'core' AND abo_number IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.member_notifications
      WHERE profile_id = v_core.id AND type = 'los_digest'
        AND created_at >= current_date AND deleted_at IS NULL
    ) THEN CONTINUE; END IF;

    SELECT COUNT(*)::int INTO v_trip_count
    FROM public.member_notifications n
    JOIN public.profiles p ON p.id = n.profile_id
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND n.type = 'trip_request'
      AND n.created_at >= now() - interval '24 hours'
      AND n.deleted_at IS NULL;

    SELECT COUNT(*)::int INTO v_doc_count
    FROM public.profiles p
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND p.valid_through IS NOT NULL
      AND p.valid_through < (current_date + interval '30 days');

    IF v_trip_count > 0 OR v_doc_count > 0 THEN
      v_message := '';
      IF v_trip_count > 0 THEN
        v_message := v_trip_count::text || ' trip request' ||
          CASE WHEN v_trip_count > 1 THEN 's' ELSE '' END || ' updated in your direct downline.';
      END IF;
      IF v_doc_count > 0 THEN
        IF v_message != '' THEN v_message := v_message || ' '; END IF;
        v_message := v_message || v_doc_count::text || ' member' ||
          CASE WHEN v_doc_count > 1 THEN 's' ELSE '' END ||
          ' in your direct downline ' ||
          CASE WHEN v_doc_count > 1 THEN 'have' ELSE 'has' END || ' expiring documents.';
      END IF;
      INSERT INTO public.member_notifications (profile_id, type, title, message, action_url)
      VALUES (v_core.id, 'los_digest', 'Daily LOS summary', v_message, '/los');
    END IF;
  END LOOP;
END;
$$;

