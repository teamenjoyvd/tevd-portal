-- Drop the old view if it exists
DROP VIEW IF EXISTS public.member_roles_leaderboard CASCADE;

-- Create the updated view renamed to member_roles_history
CREATE OR REPLACE VIEW public.member_roles_history AS
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

-- Create the get_event_years RPC function to avoid client full table scans
CREATE OR REPLACE FUNCTION public.get_event_years()
RETURNS TABLE(year int) LANGUAGE sql STABLE AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM start_time)::int AS year
  FROM public.v_roles_history
  WHERE start_time IS NOT NULL
  ORDER BY 1 DESC;
$$;
