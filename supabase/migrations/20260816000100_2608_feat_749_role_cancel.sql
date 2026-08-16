-- 2608-DEV-749: soft-cancel for event role participation.
--
-- Companion to 20260816000000_2608_feat_749_role_cancel_enum.sql, which adds
-- 'cancelled' to public.registration_status. Everything that REFERENCES the new
-- enum value has to live here: Postgres refuses to use an enum label in the same
-- transaction that added it, and the Supabase CLI runs one transaction per file.
--
-- Why soft-cancel and not a DELETE: the audit trail is the point. The two roles
-- views (member_roles_history, v_roles_history) and lib/server/event-capacity.ts
-- all filter `status = 'approved'`, so a cancelled row drops out of the
-- leaderboard, the history and the capacity exclusion with no view changes at
-- all — while still recording who gave up which slot, and when.
--
-- ROLLBACK:
--   ALTER TABLE public.event_role_requests
--     DROP COLUMN IF EXISTS cancelled_at,
--     DROP COLUMN IF EXISTS cancelled_by;
--   -- then re-run the notify_role_request_status_change() body from
--   -- 20260705000800_notification_triggers.sql:261-283 verbatim, and the
--   -- approve_event_role_request() body from
--   -- 20260811000000_2608_feat_710_approve_role_creates_registration.sql verbatim.
--   -- The enum label 'cancelled' cannot be removed (see the sibling migration).

-- ── 1. Audit columns ─────────────────────────────────────────────────────────
-- Mirrors trip_registrations, which already carries this exact pair
-- (20260315000000_baseline.sql:76-77). cancelled_by is the ACTOR: the holder
-- themself on a self-withdraw, the acting admin on a revoke.

ALTER TABLE public.event_role_requests
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid NULL
    REFERENCES public.profiles(id);

COMMENT ON COLUMN public.event_role_requests.cancelled_at IS
  '2608-DEV-749: when status moved to cancelled. NULL for every other status.';
COMMENT ON COLUMN public.event_role_requests.cancelled_by IS
  '2608-DEV-749: profile that performed the cancellation — the holder on a '
  'self-withdraw, the acting admin on a revoke.';

-- ── 2. Status-change notification ────────────────────────────────────────────
-- Body copied verbatim from the LIVE definition at
-- 20260705000800_notification_triggers.sql:261-283 (which retargeted the insert
-- from public.notifications to public.member_notifications — do NOT copy the
-- older baseline.sql:785 version, it writes to the wrong table), with two
-- additions:
--
--   a) a 'cancelled' branch in both case expressions, and
--   b) two early returns, so this feature does not notify a member about their
--      own click: a self-withdraw (cancelled_by = profile_id) and a re-request
--      (the revive branch in app/api/events/[id]/request-role/route.ts moves a
--      denied/cancelled row back to 'pending', which previously fell through to
--      the generic "has been updated" message).
--
-- An admin revoke has cancelled_by = the admin's profile id, so it still
-- notifies. CREATE OR REPLACE preserves the ACLs set by
-- 20260707120400_tighten_definer_grants.sql.

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

  -- The member re-requested the slot themselves — nothing to tell them.
  if NEW.status = 'pending' then return NEW; end if;

  -- The member withdrew their own role — nothing to tell them either.
  if NEW.status = 'cancelled'
     and NEW.cancelled_by is not null
     and NEW.cancelled_by = NEW.profile_id then
    return NEW;
  end if;

  select title into v_event_title from public.calendar_events where id = NEW.event_id;
  insert into public.member_notifications (profile_id, type, title, message, action_url)
  values (
    NEW.profile_id, 'role_request',
    case NEW.status when 'approved' then 'Role request approved'
      when 'denied' then 'Role request declined'
      when 'cancelled' then 'Role participation cancelled' else 'Role request updated' end,
    case NEW.status when 'approved' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been approved.'
      when 'denied' then 'Your ' || NEW.role_label || ' request for ' || v_event_title || ' has been declined.'
      when 'cancelled' then 'Your ' || NEW.role_label || ' role for ' || v_event_title || ' has been cancelled. The slot is open again.'
      else 'Your role request for ' || v_event_title || ' has been updated.' end,
    '/calendar'
  );
  return NEW;
end;
$$;

-- ── 3. Approval clears the cancellation markers ──────────────────────────────
-- Body copied verbatim from
-- 20260811000000_2608_feat_710_approve_role_creates_registration.sql with ONE
-- change: the "Approve the target request" UPDATE now also nulls cancelled_at /
-- cancelled_by. Without it, approving a row that was previously cancelled would
-- leave a row that is simultaneously 'approved' and carrying a cancellation
-- stamp. Everything else — the service-role/admin guard, the slot-already-filled
-- guard, the deny-competitors UPDATE, the whole 2608-DEV-710 D2 registration
-- block and the jsonb return shape — is unchanged.

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

  -- Approve the target request. 2608-DEV-749: clear any cancellation stamp, so
  -- an approved row never carries cancelled_at/cancelled_by.
  UPDATE event_role_requests
     SET status       = 'approved',
         cancelled_at = NULL,
         cancelled_by = NULL,
         updated_at   = now()
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
  --
  -- The match is LOWER()-folded: registerGuest stores the address verbatim
  -- (lib/actions/guest-registration.ts:37 is z.string().email() with no
  -- .toLowerCase()), so someone who signed up as Ivan@Example.com against a
  -- contact_email of ivan@example.com would otherwise miss the adopt and get a
  -- SECOND row — the exact outcome this block exists to prevent.
  --
  -- ...but the pre-existing UNIQUE (event_id, email) is CASE-SENSITIVE, so
  -- Ivan@Example.com and ivan@example.com can both exist as separate guest rows
  -- on one event. A bare LOWER() predicate would match BOTH and try to give
  -- them the same (event_id, profile_id), violating
  -- guest_registrations_event_profile_uniq. Hence the scalar subquery: adopt
  -- exactly ONE row, oldest first, id as a deterministic tie-break. Any further
  -- case-variant rows stay as orphan guest rows — visible and fixable, unlike a
  -- failed approval.
  UPDATE public.guest_registrations gr
     SET profile_id   = v_profile_id,
         email        = NULL,
         token        = NULL,
         expires_at   = NULL,
         cancelled_at = NULL,
         status       = 'confirmed'
    FROM public.profiles p
   WHERE p.id  = v_profile_id
     AND gr.id = (
           SELECT g.id
             FROM public.guest_registrations g
            WHERE g.event_id     = v_event_id
              AND g.profile_id   IS NULL
              AND LOWER(g.email) = LOWER(p.contact_email)
            ORDER BY g.created_at, g.id
            LIMIT 1
         )
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
  --
  -- 2608-DEV-749 note: cancelling a ROLE deliberately does not touch this row —
  -- the person may still attend. So the approve → cancel → re-request → approve
  -- sequence re-runs this upsert against the SAME registration id, and
  -- fn_schedule_guest_reminders_record upserts the queue rows
  -- ON CONFLICT (registration_id, type) — no duplicate reminder emails.
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
