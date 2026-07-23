# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #601 | `dev/2607-DEV-601` | `app/admin/calendar/components/AdminCalendarClient.tsx`, `app/admin/calendar/components/useAdminCalendarMutations.ts` (new), `app/admin/calendar/components/EventForm.tsx`, `app/admin/calendar/[id]/components/ReminderTable.tsx` — migration: no | 2026-07-23 |
| #602 | `dev/2607-DEV-602` | `app/(dashboard)/calendar/utils.test.ts` (new), `lib/format.test.ts`, `lib/server/calendar.ts`, `lib/server/calendar.test.ts` (new), `app/api/calendar/feed.ics/route.ts`, `e2e/calendar.spec.ts` (new) — migration: no | 2026-07-23 |
