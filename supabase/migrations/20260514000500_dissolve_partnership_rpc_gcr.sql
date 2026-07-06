-- Migration: 20260514_005_dissolve_partnership_rpc_gcr
-- GCR fix: add p_changed_by text parameter so the route can pass the Clerk
-- userId for the audit trail. Previously used get_my_profile_id() which
-- returns NULL under service_role, causing a NOT NULL violation on
-- role_change_audit.changed_by (text NOT NULL, stores Clerk IDs).
--
-- Old signature: dissolve_partnership(uuid)
-- New signature: dissolve_partnership(uuid, text)

CREATE OR REPLACE FUNCTION dissolve_partnership(
  p_profile_id uuid,
  p_changed_by text
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

  -- Audit trail — use the caller-supplied Clerk ID.
  INSERT INTO role_change_audit (profile_id, changed_by, old_role, new_role, note)
  VALUES (
    p_profile_id,
    p_changed_by,
    v_old_role,
    'guest',
    'Partnership dissolved by admin'
  );

  RETURN QUERY SELECT v_clerk_id, v_old_role;
END;
$$;

-- Revoke old single-arg signature and grant new two-arg signature.
REVOKE EXECUTE ON FUNCTION dissolve_partnership(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION dissolve_partnership(uuid, text) TO service_role;
