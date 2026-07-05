-- =============================================================================
-- Migration: 20260705000700_notification_rpcs.sql
-- Description: Implements enqueue_notification and claim_due_notifications RPCs.
-- =============================================================================

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

  -- Insert new row into public.notification_queue
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
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_due_notifications(
  p_channel public.notification_channel,
  p_worker_id text,
  p_limit integer DEFAULT 10
)
RETURNS SETOF public.notification_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Perform security check
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH target_rows AS (
    SELECT id
    FROM public.notification_queue
    WHERE channel = p_channel
      AND status IN ('pending', 'failed')
      AND send_at <= now()
    ORDER BY send_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_queue n
  SET status = 'claimed',
      claimed_at = now(),
      claimed_by = p_worker_id,
      attempts = n.attempts + 1
  FROM target_rows t
  WHERE n.id = t.id
  RETURNING n.*;
END;
$$;

-- Access restrictions
REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, public.notification_queue_type, public.notification_channel, jsonb, timestamptz) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, public.notification_queue_type, public.notification_channel, jsonb, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.claim_due_notifications(public.notification_channel, text, integer) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_due_notifications(public.notification_channel, text, integer) TO service_role;
