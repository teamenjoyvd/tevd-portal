-- ROLLBACK: DROP INDEX IF EXISTS public.idx_rate_limit_events_created_at;
-- ============================================================
-- [2608-DEV-625] Index the nightly rate_limit_events sweep
--
-- Follow-up to 20260804000000, raised in review of PR #693.
--
-- idx_rate_limit_events_key_created leads with bucket_key, so it serves the
-- per-key prune inside consume_rate_limit but NOT the sweep in section 4 of
-- that migration, whose only predicate is a global `created_at < now() - 2
-- days`. Leading-column mismatch means the planner falls back to a sequential
-- scan.
--
-- That is cheap while the table is small, and the per-key self-prune keeps live
-- keys at most p_max rows. But bucket_key is caller-composed from a public
-- form's email field, so an abuser can mint effectively unlimited DISTINCT
-- keys — each leaving rows that no subsequent call for that key will ever come
-- back to prune. The sweep is the only thing that collects them, and it is
-- exactly the query the existing index cannot serve.
--
-- Separate file rather than an edit to 20260804000000 because that migration is
-- already applied on DEV; both ship in the same PR, so production applies them
-- together in one gated run.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at
  ON public.rate_limit_events (created_at);
