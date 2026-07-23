## Goal
Issue #601 (2607-DEV-601, branch `dev/2607-DEV-601`): Calendar refactor 5/8 — admin calendar consolidation (extract AdminCalendarClient mutations into a hook, adopt Phase-2 shared types, converge ReminderTable onto TanStack Query, i18n remaining hardcoded strings).

## Now
PR [#649](https://github.com/teamenjoyvd/tevd-portal/pull/649) open (ready for review, not draft). CI green (Build/Lint/Test/TypeCheck/SecurityAudit/migrations-replay/Vercel), CodeRabbit re-review clean after the GCR fix commit. GCR done: 4 findings (missing `onError` on delete/cancel/resend/reschedule mutations, NaN-date reschedule-validation bypass) fixed in commit `0769247`, all 4 threads resolved via GraphQL. Only `390px smoke vs preview` CI check still pending as of last poll.

## Next
- Confirm `390px smoke vs preview` check passes
- Manual 390px + desktop click-through: admin calendar CRUD, sync button, reminders toggle/cancel/resend/reschedule (Vercel Preview READY + CI green is the Done gate, not static analysis alone — CLAUDE.md hard constraint)
- Merge PR #649 (squash, matches repo convention — no bare merge commits in `git log --merges`)
- Post-merge tail: `migrate-prod` should auto-skip (no migrations in this PR); smoke-check `https://www.teamenjoyvd.com`; remove `#601` row from `docs/CLAIMS.md`; close issue #601 (PR body already has `Closes #601`)

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No `git push` without the user explicitly asking for a push in-conversation (quote required)
- No failing check gets weakened/skipped to pass
- Never spin a solo cleanup-only PR just to prune a `docs/CLAIMS.md` row — fold it into the merging feature PR (repeat past mistake, see `feedback_no_standalone_claims_cleanup_pr` memory)

## Decisions
DECISION: #601's CodeRabbit-flagged mutation error-handling gaps (delete/cancel/resend/reschedule silently failing) fixed by adding `onError` + a visible error string near the action, matching the pattern `createMutation`/`updateMutation` already used.
DECISION: `REMINDER_LABEL_SHORT` (`components/admin/reminder-shared.ts`, consumed only by `RemindersTab.tsx`) left hardcoded English — out of #601's affected-files scope. Only `REMINDER_LABEL_LONG` (consumed by `ReminderTable.tsx`, in scope) was converted to i18n, per explicit user instruction ("fix REMINDER_LABEL_LONG in this ticket").

## Facts
- Hosted DEV Supabase project: `iymwxdewcpvpjgzewtzk`, prod: `ynykjpnetfwqzdnsgkkg`
- CI's `Authenticated E2E (Clerk)` job is a ~5s gated skip (missing secrets) — does not run specs; not real coverage. Verify locally against DEV if a change touches an authenticated flow.
- PR #649: `dev/2607-DEV-601` → `main`, title `[2607-DEV-601] Calendar refactor 5: admin calendar consolidation`, body has `Closes #601`.
- New routes this ticket added: `GET /api/admin/calendar/[id]/reminders`, `PATCH|DELETE /api/admin/reminders/[reminderId]`.

## Done
#601 BUILD — RESULT: `useAdminCalendarMutations.ts` extracted (apiClient-based); `AdminCalendarEvent` shared type adopted (`types/calendar.ts`); `ReminderTable.tsx` converged onto TanStack Query via the two new API routes above, retiring its server-action + `router.refresh()` path (`app/admin/actions/reminders.ts` kept as-is — still used by `RemindersTab.tsx`); Upcoming/Past/All pills + all of `ReminderTable`'s strings + `REMINDER_LABEL_LONG` i18n'd. `tsc --noEmit`/`npm run lint`/`npm run build` clean throughout.
#601 GCR — RESULT: CodeRabbit posted 4 findings (all real, all applied in commit `0769247`), all 4 threads resolved via GraphQL, re-review came back clean.

## Open items
- Issue #602 (calendar refactor 6/8: test coverage — date utils, ICS snapshot, calendar e2e) — not started
- `REMINDER_LABEL_SHORT`/`RemindersTab.tsx` hardcoded English — noted, not fixed (out of #601 scope)

## Failed attempts
(none this session)
