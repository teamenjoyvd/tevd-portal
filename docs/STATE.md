## Goal
BUILD issue #706 (2608-DEV-706) — member one-tap Attend + meeting-link gating, part of epic #702.
CLAIM was already complete on session start: branch `dev/2608-DEV-706` existed with commit
`692638a` (claim row registered), on top of `78c67f7` (#705, merged) and `a418cab` (#704, merged).

## Now
All 9 implementation pieces from the issue DoD are coded and pushed. PR **#717** open against `main`
from `dev/2608-DEV-706`, commits `e0e1cf5` (feature) + `5e82ac5` (E2E fix, below). `/code-review
medium` (escalated from `low` — touches auth + a migration) ran pre-push and returned 4 findings; 2
fixed (EventPopupShell "attend for link" hint now also requires `caller_registration === null` so it
can't show next to the "Attending" badge; EventPopup.tsx's split `apiClient`/`ApiError` imports
merged), 2 left as-is and tracked as **#718** (below).

First CI run: `Authenticated E2E (Clerk)` failed — `member-attend-auth.spec.ts`'s `openEventPopup`
used `page.locator('[role="row"] button', {hasText: EVENT_TITLE}).first()` unscoped. `CalendarClient`
renders both mobile (`md:hidden`) and desktop (`hidden md:block`) DOM trees at once, mobile first in
DOM order — at the `authenticated` project's 1280px viewport `.first()` locked onto the CSS-hidden
mobile button and timed out for the full 15s, every time. Not app-code, a test bug: `e2e/calendar.spec.ts`
already hit this and carries a `visible()` (`locator.and(page.locator(':visible'))`) helper with a
comment explaining it — `member-attend-auth.spec.ts` just didn't reuse it. Fixed in `5e82ac5` by
adding the same helper and scoping the event-button locator. Second CI run: all checks green
(Build, Lint, Type Check, Test, Security Audit, Replay migrations from scratch, 390px smoke,
Authenticated E2E). Migration `20260809000100_2608_feat_706_member_reminder_recipient.sql` is now
verified against a real Postgres via the replay job — first real verification, since local
Supabase/Docker was unreachable this session (see Facts).

Filed **#718** `[2608-DEV-718]` `bug` for the capacity-check race left as-is in the code review
(`member-registration.ts:78-86` mirrors the same read-then-write TOCTOU race already in
`guest-registration.ts` — no DB-level guard on `guest_capacity`). Scoped as a follow-up covering both
call sites together via one atomic DB-side check, not a #706 fix.

User is marking PR #717 ready for review now (out of draft) to get CodeRabbit moving.

## Next
1. Wait for CodeRabbit's pass on #717 now that it's out of draft -> batch-fix any findings.
2. Verify DoD point-by-point (below).
3. Merge -> approve the gated `migrate-prod` run (this PR HAS a migration, will not auto-skip) ->
   smoke-check `https://www.teamenjoyvd.com` -> remove the #706 row from `docs/CLAIMS.md` -> close #706.
4. #718 is unclaimed — not part of this ticket's finish line.

## Constraints
- Never push without an explicit grant in this conversation; the push grant used for `e0e1cf5`/
  `5e82ac5` on #706 does not carry over to other tickets or later sessions.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first. The
  migration is now replay-verified in CI (see Now/Facts) but that is CI's ephemeral Postgres, not
  DEV/prod — still ask before the gated `migrate-prod` approval on merge.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a standalone
  cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the safe local
  stack. Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#706): capacity/"full" state for the Attend button is NOT pre-computed and sent on
  `GET /api/events/[id]` — the issue's wire-in instructions for that route only mention adding
  `caller_registration`, and no DoD test covers a pre-computed capacity flag. `AttendSection` instead
  surfaces "full" as a toast after a failed POST (matched by the server's exact English error string,
  e.g. `.includes('capacity')`), same class of private client/server contract as the pre-existing
  `cal.shareError` catch-all. Revisit if the client ever needs to disable the button ahead of a click.
- DECISION (#706): `withProfile` select widened to `'id, role, contact_email, first_name, last_name'`
  in the new attend route — the issue's CLAIM correction only illustrated `id, role, contact_email`
  while making an unrelated point (dropping the redundant `requireAuth()` call); `first_name`/
  `last_name` are required to build the NOT NULL `guest_registrations.name` snapshot the #705
  migration comment documents.
- DECISION (#706): idempotent second attend (member already active) does NOT re-fire
  `notifySharerOfRegistration` — treated as a true no-op, unlike the guest path's `registerGuest`
  which re-notifies on every resubmit. A repeat tap on an already-attending member is not a new
  registration event; re-notifying would spam the sharer on every popup re-open. Covered by
  `lib/server/member-registration.test.ts` ("is idempotent on a second attend — no duplicate row, no
  re-notify").
- DECISION (#706): `member-attend-auth.spec.ts` locates the seeded event pill by
  `[role="row"] button` filtered on the event title text, matching `calendar.spec.ts`'s existing
  `[role="row"] button` selector for the popup-open assertion — no new selector convention introduced.
- DECISION (#706, CodeRabbit-shaped fix carried early): `isEventEnded` (`Date.now()` comparison) is
  computed in `EventPopup.tsx` and passed down as a prop, not computed inside
  `EventPopupShell.tsx` — `react-hooks/purity` flagged `Date.now()` inside `EventPopupShell` (which
  has no hooks) but not the structurally identical `isClosed` line already in `EventPopup.tsx` (which
  does). Root cause not fully understood; matching the working pattern was faster than debugging the
  React Compiler bailout heuristic, and keeps the derived-from-`Date.now()` values in the one file
  that already has this pattern.

## Facts
- BASELINE before this ticket's edits: `npx vitest run` -> 29 files / 378 tests. `npx tsc --noEmit`
  -> clean. `npx eslint .` -> 0 errors, 468 warnings.
- AFTER this ticket's edits: `npx vitest run` -> 31 files / 397 tests (both new files:
  `lib/server/meeting-url-visibility.test.ts` +5, `lib/server/member-registration.test.ts` +14).
  `npx tsc --noEmit` -> clean. `npx eslint .` -> 0 errors, 468 warnings (unchanged — no new warnings
  in touched files). `npx playwright test --list --project=authenticated
  e2e/member-attend-auth.spec.ts` -> 1 test collected.
- Files touched (matches the `docs/CLAIMS.md` #706 row exactly):
  `supabase/migrations/20260809000100_2608_feat_706_member_reminder_recipient.sql` (new),
  `supabase/functions/deliver-email-notifications/index.ts`,
  `lib/server/meeting-url-visibility.ts` + `.test.ts` (new),
  `lib/server/member-registration.ts` + `.test.ts` (new),
  `app/api/events/[id]/attend/route.ts` (new), `app/api/events/[id]/route.ts`,
  `app/(dashboard)/calendar/components/EventPopup.tsx`,
  `app/(dashboard)/calendar/components/popup/AttendSection.tsx` (new),
  `app/(dashboard)/calendar/components/popup/EventPopupShell.tsx`,
  `app/(dashboard)/calendar/components/popup/types.ts`,
  `lib/i18n/domains/calendar.ts`, `playwright.config.ts`,
  `e2e/member-attend-auth.spec.ts` (new). Plus `docs/ai/REF.md` (§6 route entries) — not in the
  original claim scope but required by BUILD.md FINALIZE ("update REF.md if routes changed").
- Local Supabase/Docker verification of the migration was NOT possible this session: `supabase
  status` failed with "failed to inspect container health ... open //./pipe/dockerDesktopLinuxEngine:
  The system cannot find the file specified" — Docker Desktop's engine service process is present
  (`com.docker.service`) but the daemon pipe was not reachable. The migration was written by mirroring
  `20260706000300`'s exact `SECURITY DEFINER SET search_path = public` structure and changing only the
  recipient-resolution SELECT and the two `jsonb_build_object` calls — low-risk by construction, but
  genuinely unverified against a real Postgres until CI's "Replay migrations from scratch" job runs.

## Open items
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`,
  which issue #706's own CLAIM correction (verified against `main` at `78c67f7`) says does not exist
  in this repo, and omits `deliver-email-notifications` (the function this ticket actually edited).
  Predates this ticket (#705/#704 didn't touch it either) — out of scope for #706's DoD, flagging for
  whoever picks up REF.md hygiene next.
- NOTED (not done): `docs/ai/REF.md` §5 `guest_registrations` row is stale — still shows the
  pre-#705 column list (`id, event_id, name, email, token, status, expires_at, attended_at,
  created_at`), missing `profile_id`, `cancelled_at`, `share_link_id`, `lang` from #705's migration.
  Should have been done in #705's FINALIZE; not re-touched here to keep this PR's diff scoped to #706.
- Follow-ups named in #706's own issue body, still unclaimed: #707 (member notification delivery —
  owns closing the `expires_at.is.null` widened-filter gap noted against
  `app/api/admin/calendar/[id]/route.ts` DELETE), #710 (renegotiates `guest_capacity` counting one
  human = one seat under D10), #713/#714/#715 (pre-existing, from #704's session).
- **#718** `[2608-DEV-718]` `bug` (filed this session, unclaimed): capacity check TOCTOU race, same
  shape in `guest-registration.ts` and `member-registration.ts:78-86` — no DB-level guard on
  `guest_capacity`. Fix needs to cover both call sites in one atomic DB-side check together, not
  patch one and leave the other. Not #706's DoD; do not fix inline in #706.

## Failed attempts
- First CI run on #717: `Authenticated E2E (Clerk)` failed, `member-attend-auth.spec.ts:84` —
  `openEventPopup`'s event-button locator wasn't scoped to `:visible`, so `.first()` locked onto
  `CalendarClient`'s CSS-hidden mobile-tree DOM twin at the authenticated project's 1280px viewport.
  Fixed in `5e82ac5` by adding the `visible()` helper `e2e/calendar.spec.ts` already uses for the
  same reason. Second run: green. Root-caused and fixed same session — no dangling failure.

## Done
- #705 (merged as #716, 2026-08-09, `78c67f7`) and #704 (merged as #712, `a418cab`) — both confirmed
  merged on branch inspection at #706 BUILD start; superseded the earlier "#705 IN FLIGHT" entry this
  file carried into the session.
- #703 (merged as #711, 2026-08-09) — `meeting_url` scoped out of the calendar list projection and ICS feed.
- #700 (merged as #701, 2026-08-07) — `LocationMap` size transition rebuilt on inline width/height + CSS transition.
