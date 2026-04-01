-- Atomic role update + audit insert for admin role changes via PATCH /api/admin/members/[id]
CREATE OR REPLACE FUNCTION patch_member_role(
  p_profile_id  uuid,
  p_new_role    user_role,
  p_changed_by  text,
  p_note        text DEFAULT NULL
)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role user_role;
BEGIN
  -- Fetch current role inside the transaction
  SELECT role INTO v_old_role
  FROM profiles
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found: %', p_profile_id;
  END IF;

  -- Update the role
  UPDATE profiles
  SET role = p_new_role
  WHERE id = p_profile_id;

  -- Insert audit row (same transaction — rolls back if either fails)
  INSERT INTO role_change_audit (profile_id, changed_by, old_role, new_role, note)
  VALUES (p_profile_id, p_changed_by, v_old_role, p_new_role, p_note);

  -- Return the updated profile row
  RETURN QUERY
  SELECT * FROM profiles WHERE id = p_profile_id;
END;
$$;

-- Restrict to service role only (called from server-side route handler)
REVOKE EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) TO service_role;
