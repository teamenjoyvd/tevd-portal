# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #592 | `dev/2607-DEV-592` | `lib/notifications/guest-event-changes.ts` (new), `app/api/admin/calendar/[id]/route.ts`, admin calendar edit/delete confirm dialog components, `e2e/guest-invite.spec.ts`, `scripts/seed-guest-test-user.js`/seed:smoke-guest — migration: no | 2026-07-22 |
| #596 | `dev/2607-DEV-596` | `supabase/functions/sync-google-calendar/index.ts`, `app/api/admin/calendar-sync/route.ts`, `app/admin/calendar/components/AdminCalendarClient.tsx` (status display only) — migration: no | 2026-07-22 |
