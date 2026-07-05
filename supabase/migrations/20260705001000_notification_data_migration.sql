-- =============================================================================
-- Migration: 20260705001000_notification_data_migration.sql
-- Description: Migrates pending guest reminders and historical doc expiry notifications, and adds deprecation comments.
-- =============================================================================

-- 1. Copy pending reminders from public.scheduled_reminders to public.notification_queue
INSERT INTO public.notification_queue (
  registration_id,
  event_id,
  type,
  channel,
  status,
  send_at,
  attempts,
  max_attempts,
  payload
)
SELECT 
  sr.registration_id,
  sr.event_id,
  CASE 
    WHEN sr.reminder_type = '1_hour' THEN 'event_reminder_1h'::public.notification_queue_type 
    ELSE 'event_reminder_15m'::public.notification_queue_type 
  END AS type,
  'email'::public.notification_channel AS channel,
  'pending' AS status,
  sr.send_at,
  0 AS attempts,
  3 AS max_attempts,
  jsonb_build_object(
    'email', reg.email, 
    'name', reg.name, 
    'event_title', e.title
  ) AS payload
FROM public.scheduled_reminders sr
JOIN public.guest_registrations reg ON reg.id = sr.registration_id
JOIN public.calendar_events e ON e.id = sr.event_id
WHERE sr.sent_at IS NULL
ON CONFLICT (registration_id, type) DO NOTHING;

-- 2. Seed phantom rows for historical document expirations in the last 60 days
INSERT INTO public.notification_queue (
  profile_id,
  type,
  channel,
  status,
  payload,
  send_at,
  sent_at,
  created_at,
  attempts,
  max_attempts
)
SELECT 
  mn.profile_id,
  'doc_expiry'::public.notification_queue_type AS type,
  'in_app'::public.notification_channel AS channel,
  'sent' AS status,
  jsonb_build_object(
    'document_id', mn.profile_id, 
    'document_name', 'Document'
  ) AS payload,
  mn.created_at AS send_at,
  mn.created_at AS sent_at,
  mn.created_at AS created_at,
  1 AS attempts,
  5 AS max_attempts
FROM public.member_notifications mn
WHERE mn.type::text = 'doc_expiry'
  AND mn.created_at >= now() - INTERVAL '60 days'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.notification_queue nq 
    WHERE nq.profile_id = mn.profile_id 
      AND nq.type = 'doc_expiry'::public.notification_queue_type 
      AND nq.channel = 'in_app'::public.notification_channel
      AND nq.created_at = mn.created_at
  );

-- 3. Add deprecation comments for public.scheduled_reminders, public.email_log, and public.member_notifications
COMMENT ON TABLE public.scheduled_reminders IS 'DEPRECATED: Use public.notification_queue instead.';
COMMENT ON TABLE public.member_notifications IS 'Renamed from notifications. Stores in-app notification feed history.';

-- Since public.email_log might not be created in migrations, conditionally apply the comment to avoid any errors
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_log') THEN
    EXECUTE 'COMMENT ON TABLE public.email_log IS ''DEPRECATED: Use public.notification_delivery_log instead.''';
  END IF;
END $$;
