-- AUDIT #476 (CRITICAL): patch_member_role() had no auth guard and anon retained
-- EXECUTE despite the 20260401000002 migration revoking it from PUBLIC/authenticated
-- (schema drift). Add the same guard used by promote_to_primary/dissolve_partnership
-- and explicitly revoke anon EXECUTE.
CREATE OR REPLACE FUNCTION patch_member_role(
  p_profile_id  uuid,
  p_new_role    user_role,
  p_changed_by  text,
  p_note        text DEFAULT NULL
)
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_role user_role;
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Fetch current role inside the transaction; lock the row so concurrent
  -- role changes on the same profile serialize instead of interleaving
  -- their audit rows.
  SELECT role INTO v_old_role
  FROM profiles
  WHERE id = p_profile_id
  FOR UPDATE;

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

REVOKE EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION patch_member_role(uuid, user_role, text, text) TO service_role;
