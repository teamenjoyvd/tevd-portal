-- =============================================================================
-- Migration: 20260514_001_fix_member_history_view.sql
-- Purpose:
--   GCR fixes for PR #355:
--   1) Remove duplicate role_change branch from v_member_history
--      (profiles_audit role branch double-counted with role_change_audit)
--   2) Fix misleading ERRCODE P0002 → P0001 in approve_member_verification
--      secondary-profile guard
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fix 1: v_member_history — drop profiles_audit role-change branch.
--   role_change_audit is the authoritative source (has `note` field, written
--   by patch_member_role RPC for every legitimate role change). The
--   profiles_audit table still captures old_role/new_role for raw forensic
--   queries on that table directly — it just must not be unioned here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_member_history AS
  SELECT
    profile_id,
    changed_at,
    changed_by,
    'abo_number_change'::text       AS event_type,
    'abo_number'::text              AS field,
    old_abo_number                  AS old_value,
    new_abo_number                  AS new_value
  FROM public.profiles_audit
  WHERE old_abo_number IS DISTINCT FROM new_abo_number

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'upline_abo_number_change'::text AS event_type,
    'upline_abo_number'::text        AS field,
    old_upline_abo_number            AS old_value,
    new_upline_abo_number            AS new_value
  FROM public.profiles_audit
  WHERE old_upline_abo_number IS DISTINCT FROM new_upline_abo_number

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'primary_profile_id_change'::text AS event_type,
    'primary_profile_id'::text        AS field,
    old_primary_profile_id::text      AS old_value,
    new_primary_profile_id::text      AS new_value
  FROM public.profiles_audit
  WHERE old_primary_profile_id IS DISTINCT FROM new_primary_profile_id

  UNION ALL

  SELECT
    profile_id,
    changed_at,
    changed_by,
    'role_change'::text AS event_type,
    'role'::text        AS field,
    old_role::text      AS old_value,
    new_role::text      AS new_value
  FROM public.role_change_audit;

-- ---------------------------------------------------------------------------
-- Fix 2: approve_member_verification — change ERRCODE P0002 → P0001 on the
--   secondary-profile guard. P0002 is `no_data_found` (standard SQLSTATE for
--   a SELECT that returns no rows) — semantically wrong for a record that IS
--   found but is ineligible. P0001 is the generic raise_exception code,
--   correct for application-level validation failures.
--   Full function body preserved; only ERRCODE changed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id uuid,
  p_admin_note text DEFAULT NULL::text
)
RETURNS TABLE(profile_id uuid, abo_number text, upline_abo_number text, role text, tree_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req        public.abo_verification_requests%ROWTYPE;
  v_los_sponsor text;
BEGIN
  -- Authorization: service_role (Path C) or admin users (Path B)
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the request row for the duration of the transaction
  SELECT * INTO v_req
  FROM public.abo_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request % not found', p_request_id;
  END IF;

  -- Guard: secondary profiles cannot receive standalone verification
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_req.profile_id
      AND primary_profile_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'secondary profile % cannot receive standalone verification', v_req.profile_id
      USING ERRCODE = 'P0001';
  END IF;

  -- Idempotency guard: re-running on an already-approved request
  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'request % is already approved', p_request_id
      USING ERRCODE = '23505';
  END IF;

  -- Guard: standard path must have a non-null claimed_abo
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
  END IF;

  IF v_req.request_type = 'standard' THEN
    SELECT los_members.sponsor_abo_number INTO v_los_sponsor
    FROM public.los_members
    WHERE los_members.abo_number = v_req.claimed_abo;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ABO % not found in los_members — re-import LOS before approving', v_req.claimed_abo;
    END IF;

    IF v_los_sponsor IS DISTINCT FROM v_req.claimed_upline_abo THEN
      RAISE EXCEPTION 'ABO % sponsor in LOS is % but request claims % — data mismatch',
        v_req.claimed_abo, v_los_sponsor, v_req.claimed_upline_abo;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.abo_number = v_req.claimed_abo
        AND profiles.id <> v_req.profile_id
    ) THEN
      RAISE EXCEPTION 'ABO % is already claimed by another profile', v_req.claimed_abo;
    END IF;
  END IF;

  IF v_req.request_type = 'manual' THEN
    UPDATE public.profiles
    SET role              = 'member',
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    UPDATE public.profiles
    SET role              = 'member',
        abo_number        = v_req.claimed_abo,
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  END IF;

  UPDATE public.abo_verification_requests
  SET status      = 'approved',
      resolved_at = now(),
      admin_note  = p_admin_note
  WHERE id = p_request_id;

  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );

  RETURN QUERY
  SELECT p.id,
         p.abo_number,
         p.upline_abo_number,
         p.role::text,
         t.path::text
  FROM public.profiles p
  LEFT JOIN public.tree_nodes t ON t.profile_id = p.id
  WHERE p.id = v_req.profile_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$function$;
