-- Migration: 20260514_004_dissolve_partnership_rpc
-- Wraps the dissolve_partnership profile update + role_change_audit insert
-- atomically in a SECURITY DEFINER RPC so the route cannot orphan audit rows
-- or produce a partial update under service-role.
--
-- Returns (clerk_id text, old_role user_role) so the route can sync Clerk
-- without a second DB round-trip.

CREATE OR REPLACE FUNCTION dissolve_partnership(
  p_profile_id uuid
)
RETURNS TABLE (clerk_id text, old_role user_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clerk_id   text;
  v_old_role   user_role;
BEGIN
  -- Internal auth check: Pattern A helpers return false/null under service_role
  -- with no JWT, so we must test auth.role() first.
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Fetch current state and validate the profile is actually a secondary.
  SELECT p.clerk_id, p.role
  INTO   v_clerk_id, v_old_role
  FROM   profiles p
  WHERE  p.id = p_profile_id
    AND  p.primary_profile_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found or is not a secondary account';
  END IF;

  -- Atomically clear partnership fields and demote to guest.
  UPDATE profiles
  SET    primary_profile_id = NULL,
         abo_number         = NULL,
         role               = 'guest'
  WHERE  id = p_profile_id;

  -- Audit trail.
  INSERT INTO role_change_audit (profile_id, changed_by, old_role, new_role, note)
  VALUES (
    p_profile_id,
    get_my_profile_id(),  -- null under service_role; acceptable for admin-initiated dissolves
    v_old_role,
    'guest',
    'Partnership dissolved by admin'
  );

  RETURN QUERY SELECT v_clerk_id, v_old_role;
END;
$$;

GRANT EXECUTE ON FUNCTION dissolve_partnership(uuid) TO service_role;
