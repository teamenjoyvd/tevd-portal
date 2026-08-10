# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #709 | `dev/2608-DEV-709` | `supabase/migrations/20260810000000_2608_feat_709_event_registrations_visibility_rpc.sql` (new), `app/api/events/[id]/registrations/route.ts` (new), `app/api/admin/events/[id]/registrations/route.ts` (delete), `app/(dashboard)/calendar/components/EventPopup.tsx`, `app/(dashboard)/calendar/components/popup/{CoreAdminActions.tsx→EventActionsTabs.tsx,RegistrationsTab.tsx,types.ts}`, `lib/i18n/domains/calendar.ts`, `types/supabase.ts`, `scripts/seed-clerk-test-users.js`, `playwright.config.ts`, `e2e/event-registrations-auth.spec.ts` (new) — **migration: yes** | 2026-08-10 |

