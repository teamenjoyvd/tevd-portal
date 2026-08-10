-- 2608-DEV-710 (D2): approving an event role request also registers the holder.
--
-- Body copied verbatim from 20260512000300_approve_event_role_request_rpc.sql
-- with ONE addition: an adopt-then-insert block after the deny-competitors
-- UPDATE. Everything else — the service-role/admin guard, the slot-already-
-- filled guard, SECURITY DEFINER SET search_path = public, and the
-- jsonb_build_object return shape consumed by
-- app/api/admin/event-role-requests/[id]/route.ts:64-88 — is unchanged.
--
-- CREATE OR REPLACE preserves ACLs, so no re-grant is needed.
--
-- ROLLBACK: re-run 20260512000300_approve_event_role_request_rpc.sql verbatim,
-- i.e. the CREATE OR REPLACE below with the entire
-- "-- 2608-DEV-710 (D2) ... end of D2 block" section removed.

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

  -- 2608-DEV-710 (D2): an approved role holder attends by definition, so give
  -- them a registration row — that is what grants the meeting link, the
  -- reminders, and a place on the Registrations tab.
  --
  -- Step 1 — adopt. A holder who already signed up for this event as an
  -- external guest has a row with (profile_id IS NULL, email = contact_email).
  -- Inserting on (event_id, profile_id) alone would leave TWO rows for one
  -- human: two reminder emails, and the guest row still consuming capacity.
  -- Same adopt-don't-duplicate rule attendEvent applies at
  -- lib/server/member-registration.ts:232-267 (D9).
  --
  -- The NOT EXISTS guard is what attendEvent gets for free by only adopting
  -- when it found no member row: without it, a holder carrying BOTH a guest row
  -- and a member row on this event would collide on
  -- guest_registrations_event_profile_uniq and the approval would RAISE.
  UPDATE public.guest_registrations gr
     SET profile_id   = v_profile_id,
         email        = NULL,
         token        = NULL,
         expires_at   = NULL,
         cancelled_at = NULL,
         status       = 'confirmed'
    FROM public.profiles p
   WHERE p.id           = v_profile_id
     AND gr.event_id    = v_event_id
     AND gr.profile_id  IS NULL
     AND gr.email       = p.contact_email
     AND NOT EXISTS (
       SELECT 1 FROM public.guest_registrations g2
        WHERE g2.event_id   = v_event_id
          AND g2.profile_id = v_profile_id
     );

  -- Step 2 — insert. A no-op re-confirm when step 1 already claimed the row.
  -- DO UPDATE rather than DO NOTHING so an approval reactivates a holder who
  -- had self-cancelled. status = 'confirmed' is what fires
  -- trg_schedule_guest_reminders (20260705000800:158, AFTER INSERT OR UPDATE OF
  -- status, email, name), on both the insert and the adopt/reactivate path.
  -- The triple COALESCE protects the name NOT NULL constraint; email/token/
  -- expires_at stay NULL, satisfying guest_registrations_guest_xor_member_chk.
  INSERT INTO public.guest_registrations (event_id, profile_id, name, status, lang)
  SELECT v_event_id,
         v_profile_id,
         COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
                  p.contact_email,
                  'Member'),
         'confirmed'::public.guest_registration_status,
         'en'
    FROM public.profiles p
   WHERE p.id = v_profile_id
      ON CONFLICT (event_id, profile_id) WHERE profile_id IS NOT NULL
      DO UPDATE SET cancelled_at = NULL,
                    status       = 'confirmed';
  -- end of D2 block

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
