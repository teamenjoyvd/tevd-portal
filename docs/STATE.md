## Goal
PLAN + CLAIM issue #709 (2608-DEV-709) — tiered Registrations tab (upline visibility), D5 of
epic #702. ADMIN sees every registration; CORE sees its own inclusive ltree subtree (downline
sign-ups + guests those downlines invited); MEMBER sees own sign-up + own share-link guests;
unattributed guests stay admin-only.

## Now
#709 is PR #721, open, GCR pass COMPLETE and pushed. `df358dd` applied CodeRabbit's 2 Major
findings + 3 of 4 nitpicks; `a058abb` fixed the e2e fallout from the ARIA nitpick. All 11 CI
checks green on `a058abb` (Authenticated E2E: 34 passed, the 4 registrations specs with real
timings). Both inline threads resolved; the nitpick dispositions are PR comment 5245750751.
Skipped the e2e-coverage nitpick — see Decisions. Next action: merge.

## Next
1. Merge PR #721.
2. Post-merge, approve the gated `Migrate Prod` run promptly — the route ships on merge while
   `get_event_registrations_for_viewer` waits for the gate, so the tab 500s until it is approved.
   Verify the prod ledger head actually advances to `20260810000000`.
3. Fold the `docs/CLAIMS.md` #709 row removal into the merging PR — never a standalone PR.

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
- DECISION (#709 GCR): skipped CodeRabbit's e2e-coverage nitpick (co-owner downline, ABO-less
  downline, guest 403). No guest-role Clerk fixture exists — `scripts/seed-clerk-test-users.js`
  seeds only member/admin/core — so all three cases need new Clerk users, new env vars and new
  seed legs. That is a feature-sized change, not a review fix; it belongs in its own ticket.
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

## Facts (#709)
- `EventPopup.tsx` is at `app/(dashboard)/calendar/components/`, NOT in `popup/` — the issue's
  original `popup/EventPopup.tsx` path was wrong. `adminTab` `:31`, `showMeta` `:148` (not `:116`).
- `showMeta` gates far more than the meta block: `AttendSection` (`EventPopupShell.tsx:169-185`),
  the share/QR buttons (`:186-214`) and the `cal.attendForLink` hint (`:164`) all sit inside it.
  Extending it to core/member hides the Attend button while the Registrations tab is open.
- No `core` Clerk fixture exists — `scripts/seed-clerk-test-users.js:81-82` seeds `member` + `admin`
  only, plus a profile-only downline under the member. Do NOT flip the shared member fixture's role
  in-spec: `playwright.config.ts` sets no `workers`, so files parallelize and `payments-on-behalf` /
  `profile-bento-auth` share that fixture. Seed a CORE at its own disjoint root instead.
- Sole consumer of `app/api/admin/events/[id]/registrations/route.ts` is `CoreAdminActions.tsx:15`;
  sole importer of the `GuestRegistration` type is the same file. Both safe to delete/rename.
- `email IS NULL` for member rows is enforced by `guest_registrations_guest_xor_member_chk`
  (`…705….sql:53-57`) — no masking logic needed, just don't COALESCE it back.
- BASELINE 2026-08-10 on `main@a11b89d`: `npx tsc --noEmit` clean. vitest/eslint carried from the
  #708 run on the same tree (32 files / 420 passed; 0 errors, 468 warnings).

## Done
- #709 BUILD — RESULT: 14 files, +897/-287. Verified locally: `npx tsc --noEmit` clean;
  `npx eslint .` 0 errors / 465 warnings (baseline 468 — the deleted admin route carried 3);
  `npx vitest run` 32 files / 420 passed; `npx playwright test --project=authenticated
  e2e/event-registrations-auth.spec.ts` -> **4 passed (34.0s)**, real timings, none skipped;
  full `--project=authenticated --workers=1` -> 28 passed. The 6 reds in that full run were
  `profile-bento-auth` (5) + `payments-on-behalf` L3, all caused by the local dev server dying
  mid-run (exit 127, twice) — `profile-bento-auth` ran 5/5 GREEN on this same tree minutes
  earlier, and `payments-guest` passed in isolation (10.5s).
- #709 migration applied to hosted DEV — RESULT: `get_event_registrations_for_viewer` live on
  `iymwxdewcpvpjgzewtzk` via MCP `apply_migration`; `routine_privileges` -> postgres +
  service_role only; DEV ledger row corrected from the MCP-generated `20260810154654` to the
  file version `20260810000000`. `types/supabase.ts` regenerated — diff was exactly the new
  RPC, no other drift.
- #709 PLAN + CLAIM — RESULT: verdict READY; issue body rewritten with seven corrections (five
  path/line drift, two real gaps — C6 showMeta scope, C7 missing CORE e2e fixture); Design
  Checklist 4/4; `## Branch dev/2608-DEV-709`; claim row committed at `379b889` with the merged
  #708 row pruned in the same commit.
- #708 closed — RESULT: merged as PR #720 (`a11b89d`), no migration, `Migrate Prod` auto-skips.
  Epic #702 checklist ticked; claim row removed.
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
- NOTED (not done, found during #709): the DEV ledger has NO `20260809000100` row (#706
  `fn_schedule_guest_reminders_record`), though prod does. Function-body-only, so
  `types/supabase.ts` is unaffected, but hosted DEV may be running the pre-#706 body.
- NOTED (not done, local env only): `GET /api/calendar/feed-token` 500s locally with
  "NEXT_PUBLIC_APP_URL is not set" (`lib/utils/base-url.ts:12`). Pre-existing local env gap,
  unrelated to #709.
- NOTED (not done): `e2e/profile-bento-auth.spec.ts:72` ("reset layout") fails when the shared
  DEV member profile carries leftover collapse state (`{payments:false}`) from an interrupted
  run — it passes once a completed run resets it. Order/state-dependent, not a code defect;
  worth its own ticket to make the spec seed its own starting layout.
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
- ATTEMPT 1 [L1] (#709 GCR): applied CodeRabbit's ARIA nitpick — `role="tab"` on the tab-bar
  buttons — without touching the spec -> all 4 `event-registrations-auth` specs timed out on
  `locator.click` (CI run 31430426705, 4 failed / 30 passed). CAUSE: an explicit `role="tab"`
  OVERRIDES `<button>`'s implicit ARIA role, so `openRegistrationsTab`'s
  `getByRole('button', { name: /registrations/i })` matched nothing. Fixed in `a058abb` by moving
  the single call site to `getByRole('tab', …)`. Lesson: adding an explicit ARIA role to an
  element is a REFERENCE SWEEP trigger for `getByRole` locators, not just for symbol renames.
- ATTEMPT 1 [L1] (#709 e2e): swapped bare `getByText(name)` for `data-testid`-scoped locators
  (`registration-row` / `registration-name`) -> 3 of 4 green, but the 390px case still failed:
  `getByTestId('registration-row').filter({ hasText: 'E2E Core Downline' })` resolved to 2 elements
  (`event-registrations-auth.spec.ts:278`). CAUSE unchanged and now proven at row level: as ADMIN
  the core downline appears BOTH as a registrant row and inside the `via <sharer>` line of the guest
  it invited, so `hasText` on the row is as ambiguous as it was on the page.
- ATTEMPT 1 [L1] (#708 e2e): the 390px case asserted the panel with
  `getByText(/signed in as/i).first()` -> `expect(locator).toBeVisible() failed` in CI at
  `member-share-register-auth.spec.ts:168`, twice (initial + retry #1). CAUSE: `.first()` is DOM
  order and `page.tsx` renders the desktop block (`hidden md:flex`) before the mobile one, so at
  390px it locked onto the CSS-hidden desktop copy. Fixed in `5d6e07b` with the `visible()` scope
  that `member-attend-auth.spec.ts:88-93` already documents. Green on re-run.
