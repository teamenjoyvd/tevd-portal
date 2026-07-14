-- ROLLBACK: DROP FUNCTION IF EXISTS public.release_los_submissions(uuid[]);
--           DROP FUNCTION IF EXISTS public.claim_los_submissions(uuid[], uuid);
-- ============================================================
-- Atomic claim-and-import for CORE LOS submissions.
--
-- The approve flow used to: read submissions -> filter status='pending' in JS ->
-- merge -> import_los_members -> approve_los_submissions(). A withdraw landing
-- between the read and the import could not stop data that was already written:
-- the import ran off a stale snapshot and the trailing UPDATE simply matched
-- zero rows, while the route still reported the submissions as approved.
--
-- claim_los_submissions() closes that window: one UPDATE ... WHERE status =
-- 'pending' RETURNING the payload. Whatever it returns is provably still pending
-- at claim time and is now owned by this caller — nothing else can claim it.
-- The route merges/imports ONLY the returned rows.
--
-- release_los_submissions() is the compensating action: if the import fails after
-- a successful claim, the route hands the claimed ids back to 'pending' so the
-- admin can retry, instead of leaving them marked approved-but-never-imported.
--
-- Modeled on approve_los_submissions / reject_los_submission (20260713000000).
-- ============================================================

-- ── 1. claim_los_submissions — atomically claim pending rows and return them ───

CREATE OR REPLACE FUNCTION public.claim_los_submissions(
  p_ids         uuid[],
  p_resolved_by uuid DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  root_abo_number text,
  created_at      timestamptz,
  rows            jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  UPDATE public.los_submission_requests s
  SET status      = 'approved',
      resolved_at = now(),
      resolved_by = p_resolved_by
  WHERE s.id = ANY(p_ids)
    AND s.status = 'pending'
  RETURNING s.id, s.root_abo_number, s.created_at, s.rows;
END;
$$;

-- ── 2. release_los_submissions — hand a failed claim back to 'pending' ─────────
-- Only reverses rows still sitting in 'approved'; a row an admin has since moved
-- elsewhere is left alone.

CREATE OR REPLACE FUNCTION public.release_los_submissions(
  p_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer := 0;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.los_submission_requests
  SET status      = 'pending',
      resolved_at = NULL,
      resolved_by = NULL
  WHERE id = ANY(p_ids)
    AND status = 'approved';
  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN v_released;
END;
$$;

-- ── 3. Grants — service_role only (routes call via service client) ─────────────

REVOKE EXECUTE ON FUNCTION public.claim_los_submissions(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_los_submissions(uuid[], uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_los_submissions(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_los_submissions(uuid[]) TO service_role;
