-- approval_jobs: tracks Inngest job lifecycle per verification request
-- RLS: service role only — no authenticated or anon access

CREATE TABLE IF NOT EXISTS public.approval_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID NOT NULL UNIQUE REFERENCES public.abo_verification_requests(id) ON DELETE CASCADE,
  inngest_event_id TEXT,
  status       TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'clerk_synced', 'done', 'failed')),
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at   TIMESTAMPTZ
);

ALTER TABLE public.approval_jobs ENABLE ROW LEVEL SECURITY;

-- No authenticated or anon policies — service role only
-- (service role bypasses RLS entirely; no explicit policy needed)

CREATE INDEX IF NOT EXISTS approval_jobs_request_id_idx
  ON public.approval_jobs (request_id);

CREATE INDEX IF NOT EXISTS approval_jobs_status_idx
  ON public.approval_jobs (status);

COMMENT ON TABLE public.approval_jobs IS
  'Tracks Inngest job lifecycle for the member verification approval workflow. Service role access only.';
