-- ROLLBACK: DROP FUNCTION IF EXISTS public.reject_los_submission(uuid, text, uuid);
--           DROP FUNCTION IF EXISTS public.approve_los_submissions(uuid[], uuid);
--           DROP TABLE IF EXISTS public.los_submission_requests;
-- ============================================================
-- LOS submission requests — CORE self-service uploads
--
-- CORE members upload their part of the LOS from /profile/los-upload.
-- Each upload is staged here as a `pending` submission (no direct
-- los_members write). An admin reviews the queue in approval-hub,
-- merges the selected parts (deepest-owner-wins, client-side), and
-- runs the existing import_los_members RPC; the submissions are then
-- transitioned via approve_los_submissions(). reject_los_submission()
-- declines one. Withdrawing a still-pending submission is a plain
-- owner-scoped UPDATE (RLS below).
--
-- Modeled on abo_verification_requests (table + RLS) and
-- approve_member_verification (SECURITY DEFINER guard style).
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.los_submission_requests (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  profile_id      uuid        NOT NULL,
  root_abo_number text        NOT NULL,
  rows            jsonb       NOT NULL,
  row_count       integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'pending',
  admin_note      text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz NULL,
  resolved_by     uuid        NULL,
  CONSTRAINT los_submission_requests_pkey PRIMARY KEY (id),
  CONSTRAINT los_submission_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  CONSTRAINT los_submission_requests_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT los_submission_requests_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.profiles(id)
);

-- Admin queue lists pending first; owners list their own history.
CREATE INDEX idx_los_submission_requests_status ON public.los_submission_requests (status);
CREATE INDEX idx_los_submission_requests_profile_id ON public.los_submission_requests (profile_id);

-- ── 2. RLS (Pattern A helpers only) ───────────────────────────────────────────
-- Server routes use the service client (bypasses RLS); these policies are
-- defense-in-depth for any authenticated client access.

ALTER TABLE public.los_submission_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full submission access" ON public.los_submission_requests
  FOR ALL USING (public.is_admin());

CREATE POLICY "owner can read own submission" ON public.los_submission_requests
  FOR SELECT USING (profile_id = public.get_my_profile_id());

CREATE POLICY "owner can insert own submission" ON public.los_submission_requests
  FOR INSERT WITH CHECK (profile_id = public.get_my_profile_id() AND status = 'pending');

-- Withdraw: owner may transition their own still-pending submission.
CREATE POLICY "owner can withdraw own pending submission" ON public.los_submission_requests
  FOR UPDATE
  USING (profile_id = public.get_my_profile_id() AND status = 'pending')
  WITH CHECK (profile_id = public.get_my_profile_id() AND status IN ('pending', 'withdrawn'));

-- ── 3. approve_los_submissions — transition selected submissions ──────────────
-- State transition ONLY. The actual los_members upsert stays in the API route
-- (single import_los_members call) so the import lives in one place.

CREATE OR REPLACE FUNCTION public.approve_los_submissions(
  p_ids         uuid[],
  p_resolved_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.los_submission_requests
  SET status      = 'approved',
      resolved_at = now(),
      resolved_by = p_resolved_by
  WHERE id = ANY(p_ids)
    AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

-- ── 4. reject_los_submission — decline one pending submission ─────────────────

CREATE OR REPLACE FUNCTION public.reject_los_submission(
  p_id          uuid,
  p_note        text DEFAULT NULL,
  p_resolved_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.los_submission_requests%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_req
  FROM public.los_submission_requests
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission % not found', p_id;
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'submission % is not pending (status=%)', p_id, v_req.status;
  END IF;

  UPDATE public.los_submission_requests
  SET status      = 'rejected',
      resolved_at = now(),
      resolved_by = p_resolved_by,
      admin_note  = p_note
  WHERE id = p_id;
END;
$$;

-- ── 5. Grants — service_role only (routes call via service client) ────────────

REVOKE EXECUTE ON FUNCTION public.approve_los_submissions(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_los_submissions(uuid[], uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reject_los_submission(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_los_submission(uuid, text, uuid) TO service_role;
