## Goal
BUILD issue #708 (2608-DEV-708) — recognised member on the share/register page. Second half of
D1 in epic #702: a signed-in member opening someone's `?share=` link gets one-tap Attend with the
inviter credited, never the guest name+email form.

## Now
CLAIM complete, BUILD not started. Branch `dev/2608-DEV-708` exists, cut from `main` @ `067250c`,
with `327327c` (claim row registered + #707's row pruned) and the session-state commit on top.
Working tree otherwise clean — no application code written yet.

## Next
1. SHAPE/GATHER per `docs/ai/BUILD.md`; re-read `docs/ai/GOTCHAS.md` in full.
2. Implement in this order: i18n keys -> `MemberAttendPanel.tsx` -> `register/page.tsx` wiring ->
   `playwright.config.ts:38` -> `e2e/member-share-register-auth.spec.ts`.
3. `npx vitest run`, `npx tsc --noEmit`, `npx eslint .`, then
   `npx playwright test --list --project=authenticated e2e/member-share-register-auth.spec.ts`.
4. `/code-review low` on the diff — `git add -N` any new untracked files FIRST, or they carry no
   hunks and are silently skipped (that happened on #707).
5. Push -> draft PR (CodeRabbit skips drafts) -> CI green + Vercel Preview READY -> verify DoD on
   the preview at 390px -> ready for review -> batch-fix CodeRabbit findings in ONE commit.
6. After merge: GCR post-merge tail — remove the #708 row from `docs/CLAIMS.md`, smoke-check
   production, close #708. No migration, so `Migrate Prod` will auto-skip.

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
- BASELINE at `067250c` (recorded during #707, files unchanged since): `npx vitest run` -> 32 files /
  417 tests passed. `npx tsc --noEmit` -> clean. `npx eslint .` -> 0 errors, 468 warnings.
- Production smoke 2026-08-10: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- #708 PLAN + CLAIM — RESULT: verdict READY; issue body rewritten with six corrections against
  current `main`, Design Checklist 4/4, `## Branch dev/2608-DEV-708`; `blocked` label cleared.
- #707 closed — RESULT: merged as PR #719 (`067250c`), no migration, `Migrate Prod` auto-skipped (8s).
- #706 closed — RESULT: merged as PR #717 (`1c7f5bb`); migration
  `20260809000100_2608_feat_706_member_reminder_recipient.sql` applied to prod by the gated
  `Migrate Prod` run 2026-08-09T23:13Z (2m15s, success).
- Epic #702 checklist updated: #703-#707 checked off; `blocked` cleared on #709 and #710, whose
  dependencies have all merged.

## Open items
- NOTED (not done): `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`)
  still has the detached-anchor + synchronous-`revokeObjectURL` pattern fixed in
  `AddToCalendarMenu.tsx` — same latent no-file-downloaded bug in Firefox/Safari. #707 had to leave
  `JoinActions` behaviour unchanged; fold it in here if this page adopts `AddToCalendarMenu`.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  Needs one atomic DB-side check covering both call sites. Not #708's DoD.
- **#713/#714/#715** (unclaimed, from #706) and **#709/#710** (now unblocked, ready to pick).
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`
  (does not exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still
  the pre-#705 column list.

## Failed attempts
- None this session.
