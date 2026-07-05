-- 2605-FEAT-332: approve_event_role_request RPC
-- Atomically approves one role request and denies all competing pending
-- requests for the same (event_id, role_label) slot.
-- SECURITY DEFINER — only callable with service role or admin JWT.

CREATE OR REPLACE FUNCTION approve_event_role_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id    uuid;
  v_role_label  text;
  v_profile_id  uuid;
  v_result      jsonb;
BEGIN
  -- Service-role / admin guard
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load target request
  SELECT event_id, role_label, profile_id
    INTO v_event_id, v_role_label, v_profile_id
    FROM event_role_requests
   WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found: %', p_request_id;
  END IF;

  -- Guard: slot must not already be filled
  IF EXISTS (
    SELECT 1 FROM event_role_requests
     WHERE event_id   = v_event_id
       AND role_label = v_role_label
       AND status     = 'approved'
       AND id         <> p_request_id
  ) THEN
    RAISE EXCEPTION 'Slot already filled for role "%" on event %', v_role_label, v_event_id;
  END IF;

  -- Approve the target request
  UPDATE event_role_requests
     SET status     = 'approved',
         updated_at = now()
   WHERE id = p_request_id;

  -- Deny all other pending requests for the same slot
  UPDATE event_role_requests
     SET status     = 'denied',
         updated_at = now()
   WHERE event_id   = v_event_id
     AND role_label = v_role_label
     AND id         <> p_request_id
     AND status     = 'pending';

  -- Return the approved request + profile for email dispatch
  SELECT jsonb_build_object(
    'id',          r.id,
    'role_label',  r.role_label,
    'profile_id',  r.profile_id,
    'event_id',    r.event_id,
    'status',      r.status,
    'profile',     jsonb_build_object(
                     'first_name',    p.first_name,
                     'last_name',     p.last_name,
                     'contact_email', p.contact_email
                   ),
    'event',       jsonb_build_object(
                     'title',      e.title,
                     'start_time', e.start_time
                   )
  )
    INTO v_result
    FROM event_role_requests r
    JOIN profiles           p ON p.id = r.profile_id
    JOIN calendar_events    e ON e.id = r.event_id
   WHERE r.id = p_request_id;

  RETURN v_result;
END;
$$;
