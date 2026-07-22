-- Up Migration: Add free-text description column to v_roles_history
-- REPLACE only tolerates appended columns, so `e.description` is added LAST.

CREATE OR REPLACE VIEW public.v_roles_history AS
SELECT
  e.id AS event_id,
  e.title,
  e.start_time,
  e.end_time,
  COALESCE(
    (
      SELECT p.first_name || ' ' || p.last_name
      FROM public.event_role_requests r
      JOIN public.profiles p ON p.id = r.profile_id
      WHERE r.event_id = e.id AND r.role_label = 'HOST' AND r.status = 'approved'
      LIMIT 1
    ),
    ''
  ) AS host_name,
  COALESCE(
    (
      SELECT p.first_name || ' ' || p.last_name
      FROM public.event_role_requests r
      JOIN public.profiles p ON p.id = r.profile_id
      WHERE r.event_id = e.id AND r.role_label = 'SPEAKER' AND r.status = 'approved'
      LIMIT 1
    ),
    ''
  ) AS speaker_name,
  COALESCE(
    (
      SELECT p.first_name || ' ' || p.last_name
      FROM public.event_role_requests r
      JOIN public.profiles p ON p.id = r.profile_id
      WHERE r.event_id = e.id AND r.role_label = 'PRODUCTS' AND r.status = 'approved'
      LIMIT 1
    ),
    ''
  ) AS products_name,
  e.description
FROM public.calendar_events e
WHERE EXISTS (
  SELECT 1 FROM public.event_role_slots s WHERE s.event_id = e.id
);

-- ROLLBACK:
-- CREATE OR REPLACE VIEW public.v_roles_history AS
-- SELECT
--   e.id AS event_id,
--   e.title,
--   e.start_time,
--   e.end_time,
--   COALESCE(
--     (
--       SELECT p.first_name || ' ' || p.last_name
--       FROM public.event_role_requests r
--       JOIN public.profiles p ON p.id = r.profile_id
--       WHERE r.event_id = e.id AND r.role_label = 'HOST' AND r.status = 'approved'
--       LIMIT 1
--     ),
--     ''
--   ) AS host_name,
--   COALESCE(
--     (
--       SELECT p.first_name || ' ' || p.last_name
--       FROM public.event_role_requests r
--       JOIN public.profiles p ON p.id = r.profile_id
--       WHERE r.event_id = e.id AND r.role_label = 'SPEAKER' AND r.status = 'approved'
--       LIMIT 1
--     ),
--     ''
--   ) AS speaker_name,
--   COALESCE(
--     (
--       SELECT p.first_name || ' ' || p.last_name
--       FROM public.event_role_requests r
--       JOIN public.profiles p ON p.id = r.profile_id
--       WHERE r.event_id = e.id AND r.role_label = 'PRODUCTS' AND r.status = 'approved'
--       LIMIT 1
--     ),
--     ''
--   ) AS products_name
-- FROM public.calendar_events e
-- WHERE EXISTS (
--   SELECT 1 FROM public.event_role_slots s WHERE s.event_id = e.id
-- );
