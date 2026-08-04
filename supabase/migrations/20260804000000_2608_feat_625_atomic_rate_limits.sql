-- ROLLBACK: SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'rate-limit-events-sweep';
--           DROP FUNCTION IF EXISTS public.consume_rate_limit(text, bigint, integer);
--           DROP TABLE IF EXISTS public.rate_limit_events;
-- ============================================================
-- [2608-DEV-625] Guest-invite rate limits: atomic check-then-act
--
-- The T5 abuse guards (lib/rate-limit.ts) were a JS-side read-then-decide:
-- COUNT matching rows, compare to max, and the caller does its own write
-- afterward. Nothing holds between the count and that write, so N concurrent
-- submissions all read a count below max and all proceed — which is precisely
-- the burst these guards exist to stop. They only slowed a serial abuser.
--
-- consume_rate_limit() collapses count-and-decide-and-record into ONE statement
-- from the caller's point of view. One RPC call is one transaction:
-- pg_advisory_xact_lock serializes same-key callers for its duration, and the
-- lock is released on commit — so prune -> count -> insert is atomic per key
-- while different keys stay fully parallel.
--
-- WHY A LEDGER AND NOT A COUNTER: a counter row keyed by (key, window-bucket)
-- would be one UPSERT ... RETURNING with no lock at all, but it turns a SLIDING
-- window into a FIXED one — a burst straddling a bucket boundary passes 2x max.
-- The guards being replaced are sliding (created_at >= now() - window) and the
-- issue requires preserving their scoping, so the ledger keeps one row per
-- consumed slot and the window slides with now().
--
-- The ledger does not grow: each call first deletes ITS OWN key's expired rows,
-- so a live key holds at most p_max rows. The nightly sweep in section 4 exists
-- only for keys that are never called again (a one-off abuser's email address),
-- which would otherwise sit there forever with no one to prune them.
--
-- Guard style, grants and header modeled on
-- 20260714000000_2607_feat_claim_los_submissions.sql.
-- ============================================================

-- ── 1. rate_limit_events — one row per consumed slot ──────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  -- Opaque, caller-composed scope: 'email:<recipient>',
  -- 'email:<recipient>:<template>', 'guest-reg:link:<id>', 'guest-reg:event:<id>'.
  -- Deliberately not parsed here — the DB enforces the limit, the caller owns
  -- the scoping.
  bucket_key text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_events_pkey PRIMARY KEY (id),
  -- A blank key is not a scope, and an unbounded one is an index-bloat vector
  -- reachable from a public form (the email caps key on user-supplied text).
  CONSTRAINT rate_limit_events_bucket_key_check
    CHECK (btrim(bucket_key) <> '' AND char_length(bucket_key) <= 512)
);

-- Every read and every prune is (bucket_key = ?, created_at </>= ?).
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_key_created
  ON public.rate_limit_events (bucket_key, created_at);

-- Deny by default, with NO policies at all: nothing but the service role (which
-- bypasses RLS) and the SECURITY DEFINER function below ever touches this table.
-- Writing no policy is what keeps the Pattern A / auth.jwt() trap out of reach.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM anon, authenticated;

-- ── 2. consume_rate_limit — atomically take a slot, or refuse ─────────────────
-- Returns true when a slot was consumed (caller may proceed), false when the
-- key is at its limit for the window. NOT idempotent by design: every true
-- return has recorded a row. This is why the TypeScript callers are named
-- consume*, not check* — calling it twice burns two slots.

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key       text,
  p_window_ms bigint,
  p_max       integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval;
  v_count  integer;
BEGIN
  -- SECURITY DEFINER bypasses RLS, so the authorization check lives in the body.
  -- coalesce is load-bearing: auth.role() is NULL when there is no JWT at all,
  -- and NULL <> 'service_role' evaluates to NULL, which would skip the RAISE and
  -- let an unauthenticated caller through. is_admin() is deliberately NOT part
  -- of this check — no admin path calls it.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_key IS NULL OR btrim(p_key) = ''
     OR p_window_ms IS NULL OR p_window_ms <= 0
     OR p_max IS NULL OR p_max < 0 THEN
    RAISE EXCEPTION 'consume_rate_limit: invalid arguments (key=%, window_ms=%, max=%)',
      p_key, p_window_ms, p_max;
  END IF;

  v_window := make_interval(secs => p_window_ms::double precision / 1000.0);

  -- Serializes concurrent callers of THIS key only; released on commit. A
  -- hashtext collision between two unrelated keys costs a little serialization
  -- and nothing else — the queries below are still filtered by bucket_key.
  PERFORM pg_advisory_xact_lock(hashtext(p_key)::bigint);

  DELETE FROM public.rate_limit_events
  WHERE bucket_key = p_key
    AND created_at < now() - v_window;

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE bucket_key = p_key;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events (bucket_key) VALUES (p_key);
  RETURN true;
END;
$$;

-- ── 3. Grants — service_role only (server actions call via the service client) ─

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_rate_limit(text, bigint, integer) TO service_role;

-- ── 4. Nightly sweep — bound keys that are never called again ─────────────────
-- Two days is well past the longest window in use (24h daily email cap), so this
-- can never prune a slot that is still counting.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'rate-limit-events-sweep';

SELECT cron.schedule(
  'rate-limit-events-sweep',
  '15 3 * * *',
  $$
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '2 days';
  $$
);
