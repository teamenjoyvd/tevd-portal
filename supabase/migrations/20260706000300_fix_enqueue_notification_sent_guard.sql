-- =============================================================================
-- Migration: 20260706000300_fix_enqueue_notification_sent_guard.sql
-- Description: Updates fn_schedule_guest_reminders_record to add a status guard
--              to ON CONFLICT DO UPDATE so sent/claimed reminders aren't resurrected.
-- =============================================================================

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
      status = 'pending',
      attempts = 0,
      send_at = EXCLUDED.send_at,
      payload = EXCLUDED.payload,
      sent_at = NULL,
      last_error = NULL
    WHERE notification_queue.status IN ('pending', 'failed');
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
      status = 'pending',
      attempts = 0,
      send_at = EXCLUDED.send_at,
      payload = EXCLUDED.payload,
      sent_at = NULL,
      last_error = NULL
    WHERE notification_queue.status IN ('pending', 'failed');
  END IF;
END;
$$;
