# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #749 | `dev/2608-DEV-749` | `supabase/migrations/` (**migration: yes** — enum + columns + trigger fn), `app/api/events/[id]/request-role/route.ts`, `app/api/events/[id]/route.ts`, `app/api/admin/event-role-requests/[id]/route.ts`, `app/(dashboard)/calendar/components/popup/**`, `app/admin/approval-hub/components/EventRolesTab.tsx`, `app/admin/members/[id]/components/memberDetailFormat.ts`, `lib/events/role-cutoff.ts` (new), `lib/hooks/useMinuteTick.ts` (new), `lib/email/templates/EventRoleRequestEmail.tsx`, `lib/i18n/domains/{events,calendar}.ts` | 2026-08-16 |

