-- ============================================================
-- Recreate approve_member_verification as SECURITY DEFINER
--
-- Root cause: SECURITY INVOKER + Pattern A helpers (is_admin,
-- get_my_clerk_id, etc.) return false when called from service
-- role with no JWT in scope. Cross-user writes on profiles and
-- abo_verification_requests matched 0 rows silently, leaving
-- abo_number = null while the request was marked approved.
--
-- Fix: SECURITY DEFINER runs as function owner (postgres),
-- bypassing RLS for the trusted admin-only call path.
-- SET search_path = public prevents search path injection.
--
-- Because SECURITY DEFINER bypasses RLS, the function body
-- implements its own authorization check: callers must be
-- either service_role (Path C) or an admin user (Path B).
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id uuid,
  p_admin_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req         public.abo_verification_requests%ROWTYPE;
  v_los_sponsor text;
BEGIN
  -- Authorization: allow service_role (Path C) or admin users (Path B).
  -- auth.role() returns the caller's role even inside SECURITY DEFINER;
  -- only RLS is bypassed, not the JWT context.
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

  -- Guard: standard path must have a non-null claimed_abo
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
  END IF;

  IF v_req.request_type = 'standard' THEN
    -- LOS existence guard
    SELECT sponsor_abo_number INTO v_los_sponsor
    FROM public.los_members
    WHERE abo_number = v_req.claimed_abo;

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
      WHERE abo_number = v_req.claimed_abo
        AND id <> v_req.profile_id
    ) THEN
      RAISE EXCEPTION 'ABO % is already claimed by another profile', v_req.claimed_abo;
    END IF;
  END IF;

  IF v_req.request_type = 'manual' THEN
    -- Manual path: store upline, promote role
    UPDATE public.profiles
    SET role              = 'member',
        upline_abo_number = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    -- Standard path: set abo_number + upline_abo_number + promote role
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

  -- Place in tree.
  -- Manual path: p_abo_number = NULL → placeholder label (p_<uuid>).
  -- Standard path: claimed_abo used as the ltree label.
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );
END;
$$;

-- ============================================================
-- Data patch: restore Милена's abo_number
-- Profile: 48e9c0b9-7370-417f-9cf1-fa5a9c0dcc90 / ABO 940986
-- The silent UPDATE miss left abo_number = null after approval.
-- Guard: only updates if still null to be idempotent.
-- ============================================================
UPDATE public.profiles
SET abo_number = '940986'
WHERE id = '48e9c0b9-7370-417f-9cf1-fa5a9c0dcc90'
  AND abo_number IS NULL;
