# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #609 | `dev/2607-DEV-609` | `components/ui/switch.tsx` (new), `lib/roles.ts` (new), `lib/i18n/domains/profile.ts`, `app/(dashboard)/profile/components/EmailPrefsSection.tsx`, `AboInfoContent.tsx`, `PersonalDetailsContent.tsx`, `TravelDocContent.tsx`, `TravelDocDrawerForm.tsx`, `PersonalDrawerForm.tsx`, `AdminSection.tsx`, `CalendarSection.tsx`; migration: no | 2026-07-25T14:00:00Z |
