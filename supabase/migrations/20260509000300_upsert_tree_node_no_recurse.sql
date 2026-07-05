-- ============================================================
-- Remove rebuild_tree_paths() call from upsert_tree_node.
--
-- upsert_tree_node called rebuild_tree_paths when path changed,
-- and rebuild_tree_paths called upsert_tree_node — mutual
-- recursion. Terminates today with small member counts but
-- structurally O(n²) and will blow the stack as the tree grows.
--
-- Fix: remove the conditional PERFORM rebuild_tree_paths() block.
-- Tree paths are already computed correctly within upsert_tree_node
-- via the recursive ltree construction — the full rebuild is
-- redundant and dangerous.
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_tree_node(
  p_profile_id         uuid,
  p_abo_number         text DEFAULT NULL,
  p_sponsor_abo_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label       text;
  v_sponsor_id  uuid;
  v_parent_path ltree;
  v_new_path    ltree;
BEGIN
  -- Derive a valid ltree label from abo_number or use a uuid-based placeholder
  IF p_abo_number IS NOT NULL THEN
    v_label := regexp_replace(p_abo_number, '[^a-zA-Z0-9]', '_', 'g');
  ELSE
    v_label := 'p_' || replace(p_profile_id::text, '-', '_');
  END IF;

  -- Resolve sponsor profile_id from sponsor ABO
  IF p_sponsor_abo_number IS NOT NULL THEN
    SELECT id INTO v_sponsor_id
    FROM public.profiles
    WHERE abo_number = p_sponsor_abo_number
    LIMIT 1;
  END IF;

  -- Build path: sponsor path + this node's label, or root
  IF v_sponsor_id IS NOT NULL THEN
    SELECT path INTO v_parent_path
    FROM public.tree_nodes
    WHERE profile_id = v_sponsor_id;
  END IF;

  IF v_parent_path IS NOT NULL THEN
    v_new_path := v_parent_path || v_label::ltree;
  ELSE
    v_new_path := v_label::ltree;
  END IF;

  INSERT INTO public.tree_nodes(profile_id, path)
  VALUES (p_profile_id, v_new_path)
  ON CONFLICT (profile_id) DO UPDATE
    SET path = EXCLUDED.path;

  -- NOTE: rebuild_tree_paths() call intentionally removed.
  -- It created mutual recursion with upsert_tree_node (O(n²)).
  -- Path is computed correctly above without a full rebuild.
END;
$$;
