-- =============================================================================
-- Migration: 20260706000200_fix_notification_queue_dedup.sql
-- Description: Adds a unique index for profile-scoped notifications to prevent
--              duplicates, and updates enqueue_notification to handle conflicts.
-- =============================================================================

-- 1. Create partial unique index for active profile-scoped notifications
CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_profile_type_channel_active_idx
  ON public.notification_queue (profile_id, type, channel)
  WHERE (registration_id IS NULL AND status IN ('pending', 'failed'));

-- 2. Update enqueue_notification to support conflict resolution
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_profile_id uuid,
  p_type public.notification_queue_type,
  p_channel public.notification_channel,
  p_payload jsonb,
  p_send_at timestamptz DEFAULT now()
)
RETURNS public.notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.notification_queue;
  v_max_attempts integer;
BEGIN
  -- Perform security check
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Determine max_attempts: 3 if channel is 'email', else 5
  IF p_channel = 'email'::public.notification_channel THEN
    v_max_attempts := 3;
  ELSE
    v_max_attempts := 5;
  END IF;

  -- Insert new row into public.notification_queue, or update if active profile-scoped notification already exists
  INSERT INTO public.notification_queue (
    profile_id,
    type,
    channel,
    status,
    payload,
    send_at,
    attempts,
    max_attempts
  )
  VALUES (
    p_profile_id,
    p_type,
    p_channel,
    'pending',
    p_payload,
    p_send_at,
    0,
    v_max_attempts
  )
  ON CONFLICT (profile_id, type, channel) WHERE (registration_id IS NULL AND status IN ('pending', 'failed'))
  DO UPDATE SET
    payload = EXCLUDED.payload,
    send_at = EXCLUDED.send_at,
    attempts = 0,
    last_error = NULL,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
