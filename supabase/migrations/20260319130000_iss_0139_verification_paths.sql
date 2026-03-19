-- ISS-0139: Verification paths migration
-- 1. Add request_type to abo_verification_requests
ALTER TABLE public.abo_verification_requests
  ADD COLUMN request_type TEXT NOT NULL DEFAULT 'standard'
  CONSTRAINT abo_verification_requests_request_type_check
    CHECK (request_type IN ('standard', 'manual'));

-- 2. Make claimed_abo nullable (manual path has no ABO to claim — required by ISS-0140)
ALTER TABLE public.abo_verification_requests
  ALTER COLUMN claimed_abo DROP NOT NULL;

-- 3. Add upline_abo_number to profiles
ALTER TABLE public.profiles
  ADD COLUMN upline_abo_number TEXT NULL;

-- 4. Update upsert_tree_node to handle NULL p_abo_number (no-ABO member placement)
CREATE OR REPLACE FUNCTION public.upsert_tree_node(
  p_profile_id         uuid,
  p_abo_number         text,
  p_sponsor_abo_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
declare
  v_parent_id      uuid;
  v_parent_path    ltree;
  v_path           ltree;
  v_depth          integer;
  v_label          text;
  v_had_placeholder boolean;
begin
  -- NULL-ABO path: manually-verified member without an ABO number yet.
  -- Place as a root-level placeholder node using prefixed UUID label.
  if p_abo_number is null then
    v_label     := 'p_' || replace(p_profile_id::text, '-', '');
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := null;

    insert into public.tree_nodes (profile_id, parent_id, path, depth)
    values (p_profile_id, v_parent_id, v_path, v_depth)
    on conflict (profile_id) do update set
      parent_id = excluded.parent_id,
      path      = excluded.path,
      depth     = excluded.depth;
    return;
  end if;

  -- Check if this profile currently has a placeholder (p_) node.
  -- If so, we are promoting it to a real ABO node — descendants must be repathed.
  select (path::text like 'p_%')
  into   v_had_placeholder
  from   public.tree_nodes
  where  profile_id = p_profile_id
  limit  1;

  v_label := public.abo_to_ltree_label(p_abo_number);

  if p_sponsor_abo_number is null then
    -- Root node (admin / top of tree)
    v_path      := v_label::ltree;
    v_depth     := 0;
    v_parent_id := null;
  else
    -- Find parent node via sponsor's profile
    select tn.id, tn.path, tn.depth
    into   v_parent_id, v_parent_path, v_depth
    from   public.tree_nodes tn
    join   public.profiles p on p.id = tn.profile_id
    where  p.abo_number = p_sponsor_abo_number
    limit  1;

    if v_parent_id is null then
      -- Sponsor not yet in tree — place at root temporarily
      v_path      := v_label::ltree;
      v_depth     := 0;
    else
      v_path      := v_parent_path || v_label::ltree;
      v_depth     := v_depth + 1;
    end if;
  end if;

  insert into public.tree_nodes (profile_id, parent_id, path, depth)
  values (p_profile_id, v_parent_id, v_path, v_depth)
  on conflict (profile_id) do update set
    parent_id = excluded.parent_id,
    path      = excluded.path,
    depth     = excluded.depth;

  -- If we just promoted a placeholder node to a real ABO label,
  -- rebuild all paths to fix any descendants (safe no-op if no descendants exist).
  if v_had_placeholder is true then
    perform public.rebuild_tree_paths();
  end if;
end;
$$;
