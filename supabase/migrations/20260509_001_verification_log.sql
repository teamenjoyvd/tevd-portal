-- ============================================================
-- verification_log: captures RPC exceptions for the approval
-- flow. Written by approve_member_verification EXCEPTION block.
-- Service-role only — no public or authenticated access.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.verification_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid REFERENCES public.abo_verification_requests(id) ON DELETE SET NULL,
  error_code    text,
  error_message text NOT NULL,
  error_context jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_log ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE for authenticated or anon roles.
-- All access is via service_role which bypasses RLS.
