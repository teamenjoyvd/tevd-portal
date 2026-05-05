-- 2605-BUG-271: Guard approve_member_verification against null claimed_abo
-- on standard-path requests, and establish it as the sole write gate for
-- all approval paths. Path C (POST /api/admin/verify) is refactored in
-- app-layer to insert a request row and call this RPC rather than writing
-- to profiles / tree_nodes directly.

CREATE OR REPLACE FUNCTION public.approve_member_verification(p_request_id uuid, p_admin_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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

  -- Guard: standard path must have a claimed_abo — if null, a concurrent
  -- write (e.g. Path C direct-verify upsert) clobbered it. Fail loudly
  -- rather than silently writing abo_number = null to the profile.
  IF v_req.request_type = 'standard' AND v_req.claimed_abo IS NULL THEN
    RAISE EXCEPTION 'standard verification request % has null claimed_abo — cannot approve', p_request_id;
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
    p_abo_number         => v_req.claimed_abo,
    p_sponsor_abo_number => v_req.claimed_upline_abo
  );
END;
$function$;
