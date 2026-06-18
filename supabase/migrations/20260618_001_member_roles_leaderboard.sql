-- Up Migration: Create views for leaderboard and role events history

-- View 1: Leaderboard aggregation (INNER JOIN avoids zero-participation rows)
CREATE OR REPLACE VIEW public.member_roles_leaderboard AS
SELECT 
  p.id AS profile_id,
  p.first_name,
  p.last_name,
  COALESCE(COUNT(CASE WHEN r.role_label = 'HOST' THEN 1 END), 0)::int AS host_count,
  COALESCE(COUNT(CASE WHEN r.role_label = 'SPEAKER' THEN 1 END), 0)::int AS speaker_count,
  COALESCE(COUNT(CASE WHEN r.role_label = 'PRODUCTS' THEN 1 END), 0)::int AS products_count,
  COALESCE(COUNT(r.id), 0)::int AS total_count
FROM public.profiles p
INNER JOIN public.event_role_requests r ON p.id = r.profile_id AND r.status = 'approved'
GROUP BY p.id, p.first_name, p.last_name;

-- View 2: Roles history for search and pagination (COALESCE handles PostgREST null safety)
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
  ) AS products_name
FROM public.calendar_events e
WHERE EXISTS (
  SELECT 1 FROM public.event_role_slots s WHERE s.event_id = e.id
);
