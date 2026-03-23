
CREATE OR REPLACE FUNCTION get_trip_team_attendees(
  p_trip_id        uuid,
  p_viewer_profile uuid
)
RETURNS TABLE (
  profile_id uuid,
  first_name text,
  last_name  text,
  role       text,
  abo_number text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    pr.id          AS profile_id,
    pr.first_name,
    pr.last_name,
    pr.role::text,
    pr.abo_number
  FROM profiles pr
  JOIN tree_nodes tn ON tn.profile_id = pr.id
  WHERE
    -- subtree of viewer (includes viewer themselves)
    tn.path <@ (SELECT path FROM tree_nodes WHERE profile_id = p_viewer_profile LIMIT 1)
    -- exclude the viewer themselves
    AND pr.id != p_viewer_profile
    -- must have an approved, non-cancelled registration for this trip
    AND pr.id IN (
      SELECT profile_id
      FROM trip_registrations
      WHERE trip_id     = p_trip_id
        AND status      = 'approved'
        AND cancelled_at IS NULL
    )
  ORDER BY pr.first_name, pr.last_name;
$$;
