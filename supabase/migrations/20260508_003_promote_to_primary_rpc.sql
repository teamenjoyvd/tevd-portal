-- ADR-016: Atomic RPC to swap primary/secondary roles between two linked profiles.
-- SECURITY DEFINER: bypasses RLS. Internal auth check enforces admin-or-service-role only.
-- WARNING: calls rebuild_tree_paths() — restructures the entire LOS tree.
-- Route handler surfaces a warning in the response body.
CREATE OR REPLACE FUNCTION public.promote_to_primary(
  p_current_primary_id   uuid,
  p_current_secondary_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Internal auth check: must be service_role (called from API route) or admin
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate: secondary must point to the given primary
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_current_secondary_id
      AND primary_profile_id = p_current_primary_id
  ) THEN
    RAISE EXCEPTION 'Profile % is not a secondary of %',
      p_current_secondary_id, p_current_primary_id;
  END IF;

  -- Step 1: Transfer the tree_nodes row to the new primary (current secondary)
  UPDATE tree_nodes
  SET profile_id = p_current_secondary_id
  WHERE profile_id = p_current_primary_id;

  -- Step 2: Rebuild all tree paths to reflect the profile_id change
  PERFORM rebuild_tree_paths();

  -- Step 3: Old primary becomes secondary (points to new primary)
  UPDATE profiles
  SET primary_profile_id = p_current_secondary_id
  WHERE id = p_current_primary_id;

  -- Step 4: New primary loses its secondary link (becomes primary)
  UPDATE profiles
  SET primary_profile_id = NULL
  WHERE id = p_current_secondary_id;
END;
$$;
