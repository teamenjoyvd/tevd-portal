## Goal
BUILD issue #707 (2608-DEV-707) — Attend: confirmation email, add-to-calendar, attendance
tracking. The remaining half of D4 for member sign-ups, part of epic #702. CLAIM was already
complete on session start: branch `dev/2608-DEV-707` existed with commit `34ba94a` (claim row
registered + #706's row pruned), on top of `1c7f5bb` (#706, merged as PR #717).

## Now
All four issue sections are coded on `dev/2608-DEV-707`, uncommitted in the working tree:

1. **Builders extracted** — `toGcalDate`/`buildGoogleCalUrl`/`buildOutlookUrl`/`buildIcsContent`
   moved verbatim from `JoinActions.tsx:14-76` to `lib/calendar-links.ts`; `JoinActions` imports
   them, UI untouched. `lib/calendar-links.test.ts` (10 tests) pins the exact URL params and ICS
   line output across the move.
2. **`components/AddToCalendarMenu.tsx`** — shadcn `DropdownMenu` over those builders, in
   `/components` per the 2-unrelated-routes promotion rule (popup + T6 register page). Content is
   portaled, so it carries `z-[60]` to clear the Radix Dialog's `z-50`.
3. **Token-free member join** — `app/events/[eventId]/join/page.tsx` now branches: `token` present
   -> the guest path, moved verbatim into an `if (token)` block; absent -> `auth()` -> profile by
   `clerk_id` -> active member registration -> the same idempotent `attended_at` stamp and
   `notifySharerOfAttendance` call, rendering the identical screen. Anonymous or unregistered falls
   through to the `InvalidState reason="missing"` the URL always rendered. `CancelActions` is
   gated on `token` (members cancel from the popup).
4. **Confirmation email** — `lib/email/templates/MemberEventConfirmationEmail.tsx` (en/bg, same
   `_shell` structure as `GuestEventMagicLinkEmail`), dispatched from `attendEvent` on
   create/reactivate/adopt only, via `consumeEmailCap` -> `renderEmailTemplate` ->
   `sendTransactionalEmail`. The popup's attending state gained the "Join meeting" CTA
   (`/events/[id]/join`) + `AddToCalendarMenu`.

**Not pushed.** No push grant in this conversation; the branch is local-only (`git ls-remote` shows
no `dev/2608-DEV-707` on origin), so no PR exists yet and Vercel Preview / CI have not run.

`/code-review low` ran twice per BUILD.md EXECUTE. The first pass silently skipped the four new
files — they were untracked, so they carried no hunks; `git add -N` on them and a second pass
covered them. Two findings, both addressed:
- `member-registration.ts` — `consumeEmailCap` is consumed before render/send, so a failed send
  still burns a slot. **Kept**: identical to the guest path's documented rule
  (`lib/actions/guest-registration.ts:204-206`, 2608-DEV-625). Added the comment that says so.
- `AddToCalendarMenu.tsx` — `URL.revokeObjectURL` fired synchronously after `a.click()` on a
  detached anchor, which drops the blob before the download starts in Firefox/Safari. **Fixed**:
  append/click/remove plus a next-tick revoke, matching `downloadQr` in `EventPopup.tsx`.

## Next
1. Fold in any `/code-review low` findings.
2. Ask for a push grant -> push `dev/2608-DEV-707` -> open the PR as a **draft** (CodeRabbit skips
   drafts) -> confirm CI green and Vercel Preview READY. This PR has **no migration**, so
   `migrate-prod` will auto-skip.
3. Verify the DoD point-by-point against the preview, including the 390px popup CTA row.
4. Mark ready for review -> batch-fix CodeRabbit findings in ONE commit.
5. After merge: smoke-check production, remove the #707 row from `docs/CLAIMS.md`, close #707.

## Constraints
- Never push without an explicit grant in this conversation; the push grant used for `e0e1cf5`/
  `5e82ac5` on #706 does not carry over to other tickets or later sessions.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a standalone
  cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the safe local
  stack. Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#707): `MemberEventConfirmationEmail` takes `googleCalUrl` and `outlookUrl` as props
  rather than `startTime`/`endTime`. The issue's prop list (`{ name, eventTitle, eventDateLabel,
  meetingUrl, joinUrl, lang }`) carries neither the URLs nor the raw times, and the links must be
  built server-side from `lib/calendar-links.ts` — passing the finished URLs keeps the template a
  pure presenter and keeps the builder as the single source of link shape.
- DECISION (#707): `attendEvent` returns `emailed: boolean` and the route echoes it, so the popup
  can pick `cal.attendSuccessEmailed` over `cal.attendSuccess`. The DoD requires the success copy
  not claim an email when `contact_email` is null; the existing `cal.attendSuccess` copy is already
  email-neutral, so only the *sent* case needed a new key.
- DECISION (#707): the whole email dispatch is wrapped in try/catch inside `attendEvent` and returns
  `emailed: false` on any throw. The registration is already committed when it runs, so a missing
  `NEXT_PUBLIC_APP_URL` (the #713 failure shape, live in this code path) must not turn a successful
  attend into a 400. This is failure-path handling for the new send, **not** a fix for #713 — that
  ticket still owns the guest path.
- DECISION (#707): email cap constants are duplicated as module-locals in `member-registration.ts`
  (`MEMBER_EMAIL_DAILY_CAP = 10`, 24h window) instead of imported from
  `lib/actions/guest-registration.ts`, which is `'use server'` and may therefore only export async
  functions. Same *bucket* either way — `consumeEmailCap` with no `template` keys on
  `email:${recipient}`, so members and guests share one 10/day per-recipient cap. No new scope.
- DECISION (#707): one new i18n key beyond the six reused `event.join.*` ones —
  `cal.joinRecordsAttendance` ("Records your attendance"), the caption under the popup's new "Join
  meeting" CTA. `EventPopupShell:145-156` already renders the raw `meeting_url`, which does NOT
  record attendance; the CLAIM correction requires the copy to make that difference obvious.
- DECISION (#707): the popup CTA row's 390px coverage lives in `member-attend-auth.spec.ts` under
  the `authenticated` project with a `test.use({ viewport: 390x844 })` block, not in `mobile-390`.
  `mobile-390` runs in `preview-smoke.yml` with no Clerk secrets, so an authenticated popup test
  cannot run there — same constraint that put the original attend test in `authenticated`.

## Facts
- BASELINE before this ticket's edits: `npx vitest run` -> 31 files / 399 tests passed.
  `npx tsc --noEmit` -> clean. `npx eslint .` -> 0 errors, 468 warnings.
- AFTER this ticket's edits: `npx vitest run` -> 32 files / 417 tests passed (`lib/calendar-links.test.ts`
  +10 new, `lib/server/member-registration.test.ts` 16 -> 24). `npx tsc --noEmit` -> clean.
  `npx eslint .` -> 0 errors, 468 warnings (unchanged — the 3 warnings an earlier mock shape added
  were removed by declaring the vi.fn mocks by signature instead of by implementation).
  `npx playwright test --list --project=authenticated e2e/member-attend-auth.spec.ts` -> 4 tests
  (was 1).
- E2E is **collected, not executed** — the authenticated project needs local Supabase + a seeded
  Clerk test member. Its real first run will be CI's `Authenticated E2E (Clerk)` job on the PR.
- Files touched (matches the `docs/CLAIMS.md` #707 row, plus two additions noted below):
  `lib/calendar-links.ts` + `.test.ts` (new), `components/AddToCalendarMenu.tsx` (new),
  `lib/email/templates/MemberEventConfirmationEmail.tsx` (new),
  `app/events/[eventId]/join/page.tsx`, `app/events/[eventId]/join/components/JoinActions.tsx`,
  `lib/server/member-registration.ts` + `.test.ts`, `app/api/events/[id]/attend/route.ts`,
  `app/(dashboard)/calendar/components/popup/AttendSection.tsx`,
  `app/(dashboard)/calendar/components/popup/EventPopupShell.tsx`,
  `e2e/member-attend-auth.spec.ts`. **Beyond the claim row:**
  `app/(dashboard)/calendar/components/EventPopup.tsx` (the `emailed` flag has to reach the toast)
  and `lib/i18n/domains/calendar.ts` (`cal.joinRecordsAttendance`, `cal.attendSuccessEmailed`),
  plus `docs/ai/REF.md` (§6 route row said "no email", now false).
- Verified against `main` at `1c7f5bb`: `/events/(.*)` is in `PUBLIC_ROUTE_PATTERNS`
  (`lib/public-routes.ts:29`), so the join page's `auth()` call needs no protected-route bypass;
  the six reused `event.join.*` keys all exist (`lib/i18n/domains/events.ts:45,57-61`);
  `components/ui/dropdown-menu.tsx` is already vendored.

## Open items
- NOTED (not done): `app/events/[eventId]/join/components/JoinActions.tsx:36-45` (`downloadIcs`)
  still has the detached-anchor + synchronous-revoke pattern that was fixed in
  `AddToCalendarMenu.tsx` — the same latent no-file-downloaded bug in Firefox/Safari. Left alone
  because #707's DoD requires `JoinActions`' behaviour to be unchanged across the builder move;
  worth folding into T6 when that page adopts `AddToCalendarMenu`.
- FLAKE: 3/3 pass isolated. One `npx vitest run` reported `2 failed | 415 passed` at 11:07; it
  overlapped the forked `/code-review` agent operating on this same worktree. Three subsequent
  isolated runs were 417/417 green, as were the two after the review fixes. No test was changed in
  response.
- NOTED (not done): #713 (`getBaseUrl()` throws -> half-succeeded registration) is still live on the
  guest path in `lib/actions/guest-registration.ts`. The member path added here is immune by
  construction (try/catch, above), which narrows #713 but does not close it.
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`
  (does not exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still
  the pre-#705 column list. Both predate this ticket; left alone to keep the diff scoped.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  Needs one atomic DB-side check covering both call sites. Not #707's DoD.
- Follow-ups from #706 still unclaimed: #710, #713/#714/#715.

## Failed attempts
- First typecheck of the new email mocks failed with 4× `TS2493: Tuple type '[]' of length '0' has
  no element at index '0'` — the `(...args: unknown[]) => fn(...(args as []))` shim erased the
  parameter types, so `.mock.calls[0][0]` had nothing to index. Replaced with signature-declared
  mocks (`vi.fn<(payload: SendPayload) => Promise<{sent: boolean}>>()`) whose implementations are
  set in `beforeEach`; that fixed both the type errors and the 3 unused-param lint warnings the
  first shape introduced.

## Done
- #706 (merged as PR #717, 2026-08-09, `1c7f5bb`) — member one-tap Attend + meeting-link gating.
- #705 (merged as #716, `78c67f7`) and #704 (merged as #712, `a418cab`).
- #703 (merged as #711, 2026-08-09) — `meeting_url` scoped out of the calendar list projection and ICS feed.
