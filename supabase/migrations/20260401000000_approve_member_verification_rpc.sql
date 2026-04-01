-- Wraps the three sequential writes of the member approval flow
-- (profile promotion, verification status, tree placement) in a single
-- transaction so no partial state can be written on failure.
--
-- Clerk sync and notifications are best-effort and remain in the route handler
-- after this RPC returns successfully.

CREATE OR REPLACE FUNCTION public.approve_member_verification(
  p_request_id  uuid,
  p_admin_note  text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_req         public.abo_verification_requests%ROWTYPE;
BEGIN
  -- Lock the request row for the duration of the transaction
  SELECT * INTO v_req
  FROM public.abo_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification request % not found', p_request_id;
  END IF;

  IF v_req.request_type = 'manual' THEN
    -- Manual path: member has no ABO — store upline, promote role
    UPDATE public.profiles
    SET role                = 'member',
        upline_abo_number   = v_req.claimed_upline_abo
    WHERE id = v_req.profile_id;
  ELSE
    -- Standard path: set abo_number + promote role
    UPDATE public.profiles
    SET role        = 'member',
        abo_number  = v_req.claimed_abo
    WHERE id = v_req.profile_id;
  END IF;

  -- Mark the verification request as approved
  UPDATE public.abo_verification_requests
  SET status      = 'approved',
      resolved_at = now(),
      admin_note  = p_admin_note
  WHERE id = p_request_id;

  -- Place the member in the LOS tree.
  -- Manual path: p_abo_number = NULL triggers the placeholder label (p_<uuid>).
  -- Standard path: claimed_abo used as the label.
  PERFORM public.upsert_tree_node(
    p_profile_id         => v_req.profile_id,
    p_abo_number         => v_req.claimed_abo,       -- NULL for manual path
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );
END;
$$;

-- Revoke public execute — called server-side via service role only.
REVOKE EXECUTE ON FUNCTION public.approve_member_verification(uuid, text) FROM PUBLIC;
