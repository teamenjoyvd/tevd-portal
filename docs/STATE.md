## Goal
BUILD issue #706 (2608-DEV-706) — member one-tap Attend + meeting-link gating, part of epic #702.
CLAIM was already complete on session start: branch `dev/2608-DEV-706` existed with commit
`692638a` (claim row registered), on top of `78c67f7` (#705, merged) and `a418cab` (#704, merged).

## Now
All 9 implementation pieces from the issue DoD are coded and locally green. `/code-review medium`
(escalated from `low` per BUILD.md — touches auth + a migration) ran and returned 4 findings; 2 fixed
(EventPopupShell "attend for link" hint now also requires `caller_registration === null` so it can't
show next to the "Attending" badge; EventPopup.tsx's split `apiClient`/`ApiError` imports merged), 2
left as-is (deliver-email-notifications' missing-recipient branch mirrors the pre-existing catch
block's `attempts = item.attempts || 1` pattern verbatim — not a regression; member-registration.ts's
read-then-write capacity check has the same race as the pre-existing guest path in
guest-registration.ts, which the issue explicitly said to mirror — fixing it would be scope creep
beyond #706's DoD). Re-verified after fixes: `tsc --noEmit` clean, `eslint` unchanged (0 errors, 468
warnings), `vitest run` still 31 files / 397 tests. Not yet pushed — no push grant given in this
conversation (CLAUDE.md: "Push grants are per-conversation... Re-ask").

## Next
1. Ask the user for a push grant scoped to `dev/2608-DEV-706`, then push and open the PR as **draft**
   (triggers CI + Vercel Preview; CodeRabbit skips drafts).
2. Wait CI green + preview READY. The migration adds a "Replay migrations from scratch" job — this
   session could NOT verify the migration against a live/local DB (Docker Desktop engine present but
   daemon not reachable — `supabase status` failed to inspect container health), so this CI job is
   the first real verification of `20260809000100_2608_feat_706_member_reminder_recipient.sql`.
3. Verify DoD point-by-point (below) once CI is green, including 390px and the "Authenticated E2E"
   job actually running `member-attend-auth.spec.ts` (not a #679-style green-by-skip).
4. Mark PR ready for review -> one CodeRabbit pass -> batch-fix -> merge -> approve the gated
   `migrate-prod` run (this PR HAS a migration, will not auto-skip) -> smoke-check
   `https://www.teamenjoyvd.com` -> remove the #706 row from `docs/CLAIMS.md` -> close #706.

## Constraints
- Never push without an explicit grant in this conversation; the 2026-08-09 grant on #704 does not
  carry over.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first — this
  session verified the migration only by inspection (mirrored `20260706000300`'s exact structure),
  not by execution.
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

## Failed attempts
None for #706 yet — `/code-review medium` result pending.

## Done
- #705 (merged as #716, 2026-08-09, `78c67f7`) and #704 (merged as #712, `a418cab`) — both confirmed
  merged on branch inspection at #706 BUILD start; superseded the earlier "#705 IN FLIGHT" entry this
  file carried into the session.
- #703 (merged as #711, 2026-08-09) — `meeting_url` scoped out of the calendar list projection and ICS feed.
- #700 (merged as #701, 2026-08-07) — `LocationMap` size transition rebuilt on inline width/height + CSS transition.
