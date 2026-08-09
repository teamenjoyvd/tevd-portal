-- ROLLBACK: CREATE OR REPLACE FUNCTION public.fn_schedule_guest_reminders_record(
--             p_registration_id uuid, p_start_time timestamptz, p_event_title text
--           ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
--           DECLARE
--             v_guest RECORD;
--             v_reminders_enabled boolean;
--             v_1h_enabled boolean;
--             v_15m_enabled boolean;
--           BEGIN
--             SELECT email, name, event_id INTO v_guest FROM public.guest_registrations WHERE id = p_registration_id;
--             IF v_guest IS NULL THEN RETURN; END IF;
--             SELECT reminders_enabled INTO v_reminders_enabled FROM public.calendar_events WHERE id = v_guest.event_id;
--             IF NOT coalesce(v_reminders_enabled, true) THEN RETURN; END IF;
--             SELECT (value::jsonb = '"true"'::jsonb) INTO v_1h_enabled FROM public.settings WHERE key = 'reminders_1hr_enabled';
--             SELECT (value::jsonb = '"true"'::jsonb) INTO v_15m_enabled FROM public.settings WHERE key = 'reminders_15min_enabled';
--             IF coalesce(v_1h_enabled, true) THEN
--               INSERT INTO public.notification_queue (registration_id, event_id, type, channel, status, payload, send_at, attempts, max_attempts)
--               VALUES (p_registration_id, v_guest.event_id, 'event_reminder_1h'::public.notification_queue_type, 'email'::public.notification_channel, 'pending',
--                 jsonb_build_object('email', v_guest.email, 'name', v_guest.name, 'event_title', p_event_title), p_start_time - INTERVAL '1 hour', 0, 3)
--               ON CONFLICT (registration_id, type) DO UPDATE SET status = 'pending', attempts = 0, send_at = EXCLUDED.send_at,
--                 payload = EXCLUDED.payload, sent_at = NULL, last_error = NULL
--               WHERE notification_queue.status IN ('pending', 'failed');
--             END IF;
--             IF coalesce(v_15m_enabled, true) THEN
--               INSERT INTO public.notification_queue (registration_id, event_id, type, channel, status, payload, send_at, attempts, max_attempts)
--               VALUES (p_registration_id, v_guest.event_id, 'event_reminder_15m'::public.notification_queue_type, 'email'::public.notification_channel, 'pending',
--                 jsonb_build_object('email', v_guest.email, 'name', v_guest.name, 'event_title', p_event_title), p_start_time - INTERVAL '15 minutes', 0, 3)
--               ON CONFLICT (registration_id, type) DO UPDATE SET status = 'pending', attempts = 0, send_at = EXCLUDED.send_at,
--                 payload = EXCLUDED.payload, sent_at = NULL, last_error = NULL
--               WHERE notification_queue.status IN ('pending', 'failed');
--             END IF;
--           END; $$;
-- ============================================================
-- [2608-DEV-706] Member reminder recipient
--
-- Part of #702 / T4. fn_schedule_guest_reminders_record (last redefined at
-- 20260706000300) resolved its recipient from guest_registrations.email,
-- which is NULL for member rows (2608-DEV-705). Member attend (T4) is about
-- to start writing those rows, so the reminder trigger would enqueue a
-- notification_queue row with a null recipient the moment it does — this
-- lands first so the ordering never exists in practice.
--
-- Recipient now resolves as COALESCE(gr.email, p.contact_email): guest rows
-- are unaffected (email is already NOT NULL there), member rows fall back to
-- the caller's profiles.contact_email. profiles has no lang column, so
-- member rows take the English reminder template — accepted for now, see
-- issue #706 CLAIM correction 4; a language-preference read is separate
-- design work, not part of this ticket.
--
-- If contact_email is also null (rare — 18% of DEV profiles per #704's
-- probe), queue nothing rather than a row that burns all 3 delivery attempts
-- against 'unknown'.
--
-- SECURITY DEFINER SET search_path = public carried forward verbatim — this
-- is a body replacement only, no signature or grant change, so no re-grant
-- is needed (CREATE OR REPLACE preserves ACLs).
-- ============================================================

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
  -- Member rows (profile_id IS NOT NULL) resolve their recipient from
  -- profiles.contact_email; guest rows keep using their own email.
  SELECT gr.name, gr.event_id, COALESCE(gr.email, p.contact_email) AS recipient
    INTO v_guest
  FROM public.guest_registrations gr
  LEFT JOIN public.profiles p ON p.id = gr.profile_id
  WHERE gr.id = p_registration_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_guest.recipient IS NULL THEN
    RETURN; -- queue nothing rather than a row that burns 3 attempts against 'unknown'
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
      jsonb_build_object('email', v_guest.recipient, 'name', v_guest.name, 'event_title', p_event_title),
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
      jsonb_build_object('email', v_guest.recipient, 'name', v_guest.name, 'event_title', p_event_title),
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
