## Goal
BUILD issue #708 (2608-DEV-708) — recognised member on the share/register page. Second half of
D1 in epic #702: a signed-in member opening someone's `?share=` link gets one-tap Attend with the
inviter credited, never the guest name+email form.

## Now
PR #720 is ready-for-review (no longer draft) against `main`, MERGEABLE. CodeRabbit's single pass
ran (review `4896845966`): 3 inline + 4 nitpicks. GCR applied 5 of 7 in one commit; B and E
declined with replies and left unresolved for human follow-up. Awaiting merge.

## Next
1. Merge #720 once the post-GCR checks are green (11/11) — the merge decision is a human call.
2. After merge: GCR post-merge tail — remove the #708 row from `docs/CLAIMS.md`, smoke-check
   production, close #708. No migration, so `Migrate Prod` will auto-skip.
3. Offer a ticket for the declined finding E (machine-readable attend error code) — see Open items.

## Not covered by any test (#708)
- DoD "member with `role = 'guest'` falls through to the guest form" is IMPLEMENTED
  (`register/page.tsx`, role check) but UNVERIFIED — covering it needs a guest-role profile with a
  live Clerk session, which the seed script does not provide.
- The panel's cancel path (AlertDialog -> DELETE -> back to the Attend button) is implemented and
  mirrors `AttendSection.tsx`, but no e2e case exercises it here; `member-attend-auth.spec.ts`
  covers the same route from the calendar popup.

## Constraints
- Never push without an explicit grant in this conversation. The grant used for `dev/2608-DEV-708`
  ("push the branch", 2026-08-10) does not carry over to other tickets or later sessions.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the safe local
  stack. Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#708): no `lib/actions/member-registration.ts`. `app/api/events/[id]/attend/route.ts`
  already resolves identity server-side via `withProfile`, 403s `role === 'guest'`, accepts
  `{ share }`, and delegates to `attendEvent` — the panel `fetch`es it and calls `router.refresh()`.
  A server action would be a second front door onto the same helper. Cost: `useActionState`'s no-JS
  submit is lost, acceptable because `AttendSection` is already JS-driven and the logged-out guest
  form keeps its server action untouched.
- DECISION (#708): the attending state renders from server props after `router.refresh()`, not from
  client state, so `meeting_url` is never in the page payload for someone without an active
  registration (D3).
- DECISION (#708): success does NOT redirect to `/events/[id]/join`. That page stamps `attended_at`,
  which D4 reserves for click-through, not sign-up. Link to it instead, mirroring
  `AttendSection.tsx:87-102` with the `cal.joinRecordsAttendance` caption.
- DECISION (#708): sharer name is `first_name + ' ' + last_name` (convention:
  `lib/notifications/share-events.ts:60`), not `display_names`.

## Facts
- The T4 helper is `attendEvent` (`lib/server/member-registration.ts:150`), NOT `attendEventAsMember`
  as issue #708 originally said. Self-attribution guard: `:181`, `shareLink.profile_id !== profileId`.
- `playwright.config.ts` has ONE spec list, `AUTHENTICATED_SPECS` at `:38` — the three-list form the
  issue describes no longer exists. Add `member-share-register-auth` there and nowhere else.
- `event_share_links` has a single FK to `profiles` (`20260504000001_event_share_links.sql:7`), so
  `profile:profiles(first_name, last_name)` needs no PostgREST hint.
- Server-side member identity pattern to copy: `app/events/[eventId]/join/page.tsx:165-174`
  (`auth()` -> `profiles` by `clerk_id`). Works because `/events/(.*)` is in `PUBLIC_ROUTE_PATTERNS`
  (`lib/public-routes.ts:29`).
- BASELINE re-measured 2026-08-10 before the #708 edits: `npx vitest run` -> 32 files / **420** tests
  passed (#707's note of 417 was stale). `npx tsc --noEmit` -> clean. `npx eslint .` -> 0 errors, 468
  warnings. After the #708 commit: all three identical, and
  `npx playwright test --list --project=authenticated e2e/member-share-register-auth.spec.ts` ->
  `Total: 4 tests in 1 file`, with 0 hits under `--project=desktop --project=mobile-390`.
- Production smoke 2026-08-10: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- #708 GCR (PR #720) — RESULT: 5 findings applied in one commit, 2 declined. Applied: empty
  `memberName` no longer renders a dangling "Signed in as " (`MemberAttendPanel.tsx`); the attend
  button keeps its accessible name with `aria-busy` instead of swapping the label for '…'; the
  duplicated 9-prop `MemberAttendPanel` call is hoisted to one `memberPanel` const used by both
  layout blocks; `if (share)` -> `share !== undefined && share !== ''`; the e2e "Invited by"
  assertion uses `getByText(string, { exact: false })` instead of a RegExp built from a DB name.
  Verified: `tsc --noEmit` clean, `eslint` 0 errors, `vitest run` 32 files / 420 passed,
  `playwright --project=authenticated member-share-register-auth` -> `5 passed (6.1m)` against
  hosted DEV, real timings.
- #708 BUILD — RESULT: draft PR #720 at `c2071dd`, all 11 checks green, Authenticated E2E 30 passed
  (5 new cases, none skipped). DoD verified by test: one-tap panel with no name/email inputs,
  `share_link_id` = inviter's link, own link -> null, logged-out guest form unchanged, full event
  does not block an active member, meeting link absent before / present after attending, 390px.
- #708 BUILD — RESULT: `bce3c28`, 5 files, +571/-3. All six issue corrections honoured: reused the
  attend route (no `lib/actions/member-registration.ts`), one `playwright.config.ts` edit, server-
  rendered attending state, link-not-redirect to `/join`, `first_name + last_name` for the sharer.
  Deviation logged: 571 lines vs the ~260 estimate (2.2x), no unplanned file or kind of change.
- #708 PLAN + CLAIM — RESULT: verdict READY; issue body rewritten with six corrections against
  current `main`, Design Checklist 4/4, `## Branch dev/2608-DEV-708`; `blocked` label cleared.
- #707 closed — RESULT: merged as PR #719 (`067250c`), no migration, `Migrate Prod` auto-skipped (8s).
- #706 closed — RESULT: merged as PR #717 (`1c7f5bb`); migration
  `20260809000100_2608_feat_706_member_reminder_recipient.sql` applied to prod by the gated
  `Migrate Prod` run 2026-08-09T23:13Z (2m15s, success).
- Epic #702 checklist updated: #703-#707 checked off; `blocked` cleared on #709 and #710, whose
  dependencies have all merged.

## Open items
- NOTED (not done, declined CodeRabbit finding on #720, needs its own ticket): client error copy is
  selected by matching ENGLISH server text. `MemberAttendPanel.tsx:73-78` does
  `raw.includes('capacity')` / `raw.includes('already ended')`, and
  `app/(dashboard)/calendar/components/EventPopup.tsx:76-78` does the identical thing — 2 call
  sites onto the same route. A real fix needs a machine-readable discriminator: a `code` on
  `attendEvent`'s failure result (`lib/server/member-registration.ts`), passed through
  `app/api/events/[id]/attend/route.ts`, and surfaced on `ApiError` (`lib/apiClient.ts:13`, which
  today carries only `status` and `message`). Out of #708's DoD; localizing or rewording those
  server strings silently breaks both consumers.
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not
  deferred: `playwright.config.ts` never sets `fullyParallel`, so Playwright 1.61 parallelizes by
  FILE. Both `describe` blocks live in one spec file, so all 5 tests already share one worker in
  declaration order — confirmed by `Running 5 tests using 1 worker`. Do not "fix" this later.
- NOTED (not done, found during #708): a signed-in member blocked by a FULL event still gets
  `ResendLinkForm` — the guest magic-link resend — at `app/events/[eventId]/register/page.tsx:162`
  and `:209`. Wrong flow for a portal identity, but it is the pre-existing blocked branch and
  outside #708's DoD, which only required that a full event not block an already-active member.
- NOTED (not done): `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`)
  still has the detached-anchor + synchronous-`revokeObjectURL` pattern fixed in
  `AddToCalendarMenu.tsx` — same latent no-file-downloaded bug in Firefox/Safari. #707 had to leave
  `JoinActions` behaviour unchanged; fold it in here if this page adopts `AddToCalendarMenu`.
  STILL OPEN after #708: the register page adopted `AddToCalendarMenu` (already carrying the fixed
  pattern), but `JoinActions` lives on the join page and was not touched. Needs its own ticket.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  Needs one atomic DB-side check covering both call sites. Not #708's DoD.
- **#713/#714/#715** (unclaimed, from #706) and **#709/#710** (now unblocked, ready to pick).
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`
  (does not exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still
  the pre-#705 column list.

## Failed attempts
- ATTEMPT 1 [L1] (#708 e2e): the 390px case asserted the panel with
  `getByText(/signed in as/i).first()` -> `expect(locator).toBeVisible() failed` in CI at
  `member-share-register-auth.spec.ts:168`, twice (initial + retry #1). CAUSE: `.first()` is DOM
  order and `page.tsx` renders the desktop block (`hidden md:flex`) before the mobile one, so at
  390px it locked onto the CSS-hidden desktop copy. Fixed in `5d6e07b` with the `visible()` scope
  that `member-attend-auth.spec.ts:88-93` already documents. Green on re-run.
