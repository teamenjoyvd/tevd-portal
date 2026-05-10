-- Fix ambiguous column reference in approve_member_verification.
-- los_members.abo_number was unqualified in the WHERE clause; with the
-- RETURNS TABLE column also named abo_number, PG could raise
-- "column reference is ambiguous" in some planner paths.
-- Also qualifies profiles.abo_number in the duplicate guard for symmetry.

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

  -- Idempotency guard: re-running on an already-approved request
  -- raises unique_violation (SQLSTATE 23505) so callers can 409.
  IF v_req.status = 'approved' THEN
    RAISE EXCEPTION 'request % is already approved', p_request_id
      USING ERRCODE = '23505';
  END IF;

  -- Guard: standard path must have a non-null claimed_abo
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
  END IF;

  IF v_req.request_type = 'standard' THEN
    -- LOS existence guard — qualify abo_number to avoid ambiguity with RETURNS TABLE column
    SELECT los_members.sponsor_abo_number INTO v_los_sponsor
    FROM public.los_members
    WHERE los_members.abo_number = v_req.claimed_abo;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ABO % not found in los_members — re-import LOS before approving', v_req.claimed_abo;
    END IF;

    -- Sponsor mismatch guard
    IF v_los_sponsor IS DISTINCT FROM v_req.claimed_upline_abo THEN
      RAISE EXCEPTION 'ABO % sponsor in LOS is % but request claims % — data mismatch',
        v_req.claimed_abo, v_los_sponsor, v_req.claimed_upline_abo;
    END IF;

    -- Duplicate guard: another profile already owns this ABO
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

  -- Mark approved
  UPDATE public.abo_verification_requests
  SET status      = 'approved',
      resolved_at = now(),
      admin_note  = p_admin_note
  WHERE id = p_request_id;

  -- Place in tree
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );

  -- Return the promoted profile row for caller confirmation
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
