# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #706 | `dev/2608-DEV-706` | `supabase/migrations/20260809000100_2608_feat_706_member_reminder_recipient.sql` (new), `supabase/functions/deliver-email-notifications/index.ts`, `lib/server/meeting-url-visibility.ts` + `.test.ts` (new), `lib/server/member-registration.ts` + `.test.ts` (new), `app/api/events/[id]/attend/route.ts` (new), `app/api/events/[id]/route.ts`, `app/(dashboard)/calendar/components/EventPopup.tsx`, `app/(dashboard)/calendar/components/popup/AttendSection.tsx` (new), `app/(dashboard)/calendar/components/popup/EventPopupShell.tsx`, `app/(dashboard)/calendar/components/popup/types.ts`, `lib/i18n/domains/calendar.ts`, `playwright.config.ts`, `e2e/member-attend-auth.spec.ts` (new) — **migration: yes** | 2026-08-09 |

