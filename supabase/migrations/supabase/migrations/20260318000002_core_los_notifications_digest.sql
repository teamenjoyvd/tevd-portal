-- ISS-0044: Core LOS notifications — digest pattern
-- ────────────────────────────────────────────────────────────────
-- 1. Add los_digest to notification_type enum
-- ────────────────────────────────────────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'los_digest';

-- ────────────────────────────────────────────────────────────────
-- 2. get_core_ancestors(p_profile_id uuid) → setof uuid
--    Returns profile IDs of all Core members that are ltree
--    ancestors of the given profile (via tree_nodes).
--    Returns empty set if the profile has no tree_node entry.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_core_ancestors(p_profile_id uuid)
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id
  FROM tree_nodes tn_self
  JOIN tree_nodes tn_anc
    ON tn_anc.path @> tn_self.path
   AND tn_anc.path::text != tn_self.path::text
  JOIN profiles p ON p.id = tn_anc.profile_id
  WHERE tn_self.profile_id = p_profile_id
    AND p.role = 'core';
$$;

-- ────────────────────────────────────────────────────────────────
-- 3. Update notify_role_request to also fan-out to Core ancestors
--    of the requester (on event_role_requests INSERT).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_role_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_event_title text;
  v_member_name text;
begin
  select title into v_event_title
    from public.calendar_events where id = NEW.event_id;

  select first_name || ' ' || last_name into v_member_name
    from public.profiles where id = NEW.profile_id;

  -- Notify admins (existing behaviour)
  insert into public.notifications (profile_id, type, title, message, action_url)
  select
    p.id,
    'role_request',
    'New role request',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title,
    '/admin/approval-hub'
  from public.profiles p
  where p.role = 'admin';

  -- Notify Core ancestors of the requester in their ltree upline
  insert into public.notifications (profile_id, type, title, message, action_url)
  select
    anc_id,
    'role_request',
    'Role request in your network',
    v_member_name || ' requested ' || NEW.role_label || ' for ' || v_event_title,
    '/admin/approval-hub'
  from get_core_ancestors(NEW.profile_id) AS anc_id;

  return NEW;
end;
$function$;

-- ────────────────────────────────────────────────────────────────
-- 4. run_los_digest() — called by pg_cron daily at 06:00 UTC
--    For each Core member with an ABO number:
--      a) Skip if a digest was already inserted today (dedup).
--      b) Count trip_request notifications to direct downline
--         members in the last 24 h (proxy for status changes,
--         since trip_registrations has no updated_at).
--      c) Count direct downline members with valid_through
--         expiring within 30 days.
--      d) If either count > 0: insert one los_digest notification.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_los_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_core       RECORD;
  v_trip_count int;
  v_doc_count  int;
  v_message    text;
BEGIN
  FOR v_core IN
    SELECT id, abo_number
    FROM public.profiles
    WHERE role = 'core'
      AND abo_number IS NOT NULL
  LOOP
    -- Dedup: skip if digest already sent today for this Core member
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE profile_id = v_core.id
        AND type = 'los_digest'
        AND created_at >= current_date
        AND deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- Count trip_request notifications delivered to direct downline
    -- members in the last 24 h (fired by notify_registration_status_change
    -- on trip_registrations status UPDATE).
    SELECT COUNT(*)::int INTO v_trip_count
    FROM public.notifications n
    JOIN public.profiles p ON p.id = n.profile_id
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND n.type = 'trip_request'
      AND n.created_at >= now() - interval '24 hours'
      AND n.deleted_at IS NULL;

    -- Count direct downline members with documents expiring within 30 days
    SELECT COUNT(*)::int INTO v_doc_count
    FROM public.profiles p
    JOIN public.los_members lm ON lm.abo_number = p.abo_number
    WHERE lm.sponsor_abo_number = v_core.abo_number
      AND p.valid_through IS NOT NULL
      AND p.valid_through < (current_date + interval '30 days');

    -- Only insert if there is something to report
    IF v_trip_count > 0 OR v_doc_count > 0 THEN
      v_message := '';

      IF v_trip_count > 0 THEN
        v_message := v_trip_count::text
          || ' trip request'
          || CASE WHEN v_trip_count > 1 THEN 's' ELSE '' END
          || ' updated in your direct downline.';
      END IF;

      IF v_doc_count > 0 THEN
        IF v_message != '' THEN v_message := v_message || ' '; END IF;
        v_message := v_message
          || v_doc_count::text
          || ' member'
          || CASE WHEN v_doc_count > 1 THEN 's' ELSE '' END
          || ' in your direct downline '
          || CASE WHEN v_doc_count > 1 THEN 'have' ELSE 'has' END
          || ' expiring documents.';
      END IF;

      INSERT INTO public.notifications (profile_id, type, title, message, action_url)
      VALUES (v_core.id, 'los_digest', 'Daily LOS summary', v_message, '/los');
    END IF;

  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5. Schedule daily digest at 06:00 UTC (08:00 Sofia time)
-- ────────────────────────────────────────────────────────────────
SELECT cron.unschedule('los-digest-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'los-digest-daily'
);
SELECT cron.schedule(
  'los-digest-daily',
  '0 6 * * *',
  'SELECT public.run_los_digest()'
);
