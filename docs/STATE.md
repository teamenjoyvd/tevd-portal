## Goal
BUILD issue #710 (2608-DEV-710) on branch `dev/2608-DEV-710` — D2: approving an event role
request auto-creates/adopts an active `guest_registrations` row for the holder; D10: capacity
counting excludes approved role holders.

## Now
#710 is **PR #725** at `c97e836`. All 11 CI checks green, Vercel preview READY, DoD verified
point-by-point. Marking it ready for review, which triggers the single CodeRabbit pass.

## Next
1. Apply CodeRabbit's findings as ONE batched commit (each push re-triggers an incremental review;
   drip-fed fixes burn quota). Wrong findings: reply on the thread and resolve, do not churn code.
3. Merge, then approve the gated `Migrate Prod` run promptly and confirm the prod ledger head
   advances to `20260811000000`. The RPC ships on merge; until the gate is approved, approving a
   role request will NOT create a registration row in prod.
4. Smoke-check `https://www.teamenjoyvd.com`. The `docs/CLAIMS.md` #710 row is pruned by the NEXT
   ticket's CLAIM commit, matching how `cdadc1d` pruned #709 — never a standalone cleanup PR.

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions do
  not carry over.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#710, from PLAN): capacity is counted in TypeScript across two round trips, not via
  `.or('profile_id.is.null,profile_id.not.in.(…)')` — PostgREST cannot express `NOT IN (subquery)`,
  and the `FakeQuery` in `lib/server/member-registration.test.ts:64-113` implements only `eq`/`is`,
  no `or`.
- DECISION (#710, from PLAN): the helper lives in `lib/server/event-capacity.ts`, NOT in
  `lib/actions/guest-registration.ts` — that file is `'use server'`, so every export becomes a
  server-action endpoint.
- DECISION (#710, from PLAN): the RPC does adopt-then-insert (D9 shape), not a bare insert —
  inserting on `(event_id, profile_id)` alone would leave a second row for a human who had already
  registered as an external guest.

## Facts
- BASELINE 2026-08-11 on `dev/2608-DEV-710@cdadc1d`:
  `npx vitest run lib/actions/guest-registration.test.ts lib/server/member-registration.test.ts`
  -> 2 files / **50 passed**. `npx tsc --noEmit` -> **1 error**, and it is STALE GENERATED OUTPUT:
  `.next/dev/types/validator.ts(566,39)` still references
  `app/api/admin/events/[id]/registrations/route.js`, deleted by #709. Not a source error; expect it
  to persist until `.next` is regenerated.
- Exactly 3 capacity counts exist against `guest_registrations`:
  `app/events/[eventId]/register/page.tsx:40`, `lib/server/member-registration.ts:206`,
  `lib/actions/guest-registration.ts:160`. (`e2e/guest-invite.spec.ts:134` is a test assertion, not
  a call site.)
- `app/api/admin/calendar/route.ts:62-68` is a row FETCH with `.not('email','is',null)`, not a
  `count: 'exact'` capacity count — correction A confirmed against `main`.
- `registration_status` enum = `('pending','approved','denied')` (baseline:24);
  `guest_registration_status` = `('pending','confirmed')`.
- `guest_registrations_event_profile_uniq` is `(event_id, profile_id) WHERE profile_id IS NOT NULL`
  (`20260809000000:60-61`); `guest_registrations_guest_xor_member_chk` at `:53-57`.
- `-- ROLLBACK:` convention: first line of the migration file
  (`20260810000000_2608_feat_709_event_registrations_visibility_rpc.sql:1`).
- Production smoke 2026-08-10: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- #710 CI on `c97e836` — RESULT: all 11 checks green. `Replay migrations from scratch` 2m27s (the
  migration DoD item). `Authenticated E2E (Clerk)` 6m13s and it REALLY RAN, not a green-by-skip:
  the job log shows `Running 34 tests using 2 workers` -> `34 passed (3.0m)`. `390px smoke vs
  preview` 2m27s. Vercel preview READY. CodeRabbit correctly skipped (draft).
- #710 Registrations-tab DoD verified on hosted DEV — RESULT: after approval,
  `get_event_registrations_for_viewer(event, admin_viewer)` returns exactly 1 row,
  `registrant='Tab Host'`, `is_member=t`, `email` NULL, `status=confirmed`, `profile_id` set. NOTE
  the RPC's column is `registrant`, NOT `name` — a `rec.name` reference fails with
  "record has no field name".
- #710 RPC verified on hosted DEV (`iymwxdewcpvpjgzewtzk`) — RESULT: **7/7 scenarios pass**, run as
  one rolled-up DO block with `request.jwt.claims` set to `{"role":"service_role"}` to satisfy the
  RPC's internal guard, with all scratch rows deleted afterwards (re-checked: 0 left). S1 approval
  creates one `confirmed`, `cancelled_at` NULL, `email` NULL row named from the profile; S1 return
  shape still has all 7 top-level keys; S2 double approval -> 1 row, same id; S3 self-cancelled
  holder reactivates; S4 an existing guest row is adopted in place (same id, `created_at`
  preserved, email/token/expires_at NULL) -> exactly ONE row; S5 guest row + member row does NOT
  raise (the NOT EXISTS guard); S6 a case-mismatched guest email IS adopted (the LOWER fix).
  Ledger version corrected from the MCP-generated `20260810222333` to the file version
  `20260811000000`.
- #710 `/code-review medium` — RESULT: 5 findings, 2 in this diff and both FIXED, 3 out of scope
  (they live in files already merged to `main` via #721/#724 — logged under Open items).
  Fixed 1 (medium): `countAttendeesForCapacity` counted fetched rows, but
  `supabase/config.toml:14` sets `max_rows = 1000` — which caps rows returned and never applied to
  the `count: 'exact'` query it replaced — so an event with `guest_capacity >= 1000` would have
  stopped enforcing capacity. Now two head:true exact counts (total, minus role holders via
  `.in()`). Fixed 2 (low): the adopt step matched `gr.email = p.contact_email` case-sensitively;
  `registerGuest` stores the address verbatim (`z.string().email()`, no `.toLowerCase()`), so a
  case-mismatched signup would have produced the duplicate row the block exists to prevent. Now
  `LOWER(...) = LOWER(...)`, proved by S6.
- #710 BUILD (code complete) — RESULT: 7 files. New
  `20260811000000_2608_feat_710_approve_role_creates_registration.sql` (RPC body verbatim from
  `20260512000300` + adopt-then-insert) and new `lib/server/event-capacity.ts`
  (`countAttendeesForCapacity`); all 3 capacity call sites routed through it; comment-only update at
  `app/api/admin/calendar/route.ts`. Verified locally: `npx vitest run` -> 32 files / **423 passed**
  (baseline 420 + 3 new capacity cases); `npx eslint .` -> 0 errors / 465 warnings (baseline 465);
  `npx tsc --noEmit` -> only the pre-existing stale `.next/dev/types/validator.ts` error.
  `grep -rn "count: 'exact'" lib app` -> no remaining count against `guest_registrations`.
- #710 DEVIATION from the issue body: the adopt UPDATE gained a
  `NOT EXISTS (… g2.profile_id = v_profile_id)` guard. Without it, a holder carrying BOTH a guest
  row and a member row on the same event would collide on `guest_registrations_event_profile_uniq`
  and the whole approval would RAISE. `attendEvent` gets this guard for free by only adopting when
  it found no member row (`lib/server/member-registration.ts:238`).
- #710 PLAN + CLAIM — RESULT: verdict READY; issue body carries three PLAN corrections (A: admin
  calendar route stays out of the helper; B: RPC needs a D9-style adopt step; C: count in TS);
  Design Checklist 4/4; `## Branch dev/2608-DEV-710`; claim row committed at `cdadc1d` with the
  merged #709 row pruned in the same commit.
- #709 closed — RESULT: merged as PR #721 (`9288601`); tiered Registrations tab live.
- #708 closed — RESULT: merged as PR #720 (`a11b89d`).
- #722 closed — RESULT: merged as PR #724 (`ef0c3e1`), E2E aborts on a dead dev server.

## Open items
- NOTED (not done, same-class defect found by `/code-review medium` on #710): the case-sensitive
  email match fixed in the #710 RPC also exists in TypeScript at
  `lib/server/member-registration.ts:239` — `.eq('email', contactEmail)` in `attendEvent`'s D9
  adopt step. Same failure: a member who signed up as `Ivan@Example.com` is not adopted and gets a
  second row. 2 instances of the class total; 1 fixed here (the RPC), 1 left because it is outside
  #710's DoD. Fixing it needs either a citext/lower() index or a `.ilike()` lookup — its own ticket.
- NOTED (not done, out of #710's scope — merged in #721): `EventPopup.tsx:156`'s
  `showMeta = activeTab !== 'registrations'` now applies to EVERY role, and
  `EventPopupShell.tsx:169-214` puts `AttendSection` + the share/QR buttons inside that gate. A
  member who opens the Registrations tab loses the Attend button with no affordance explaining why.
  Previously unreachable, since members had no tab bar at all — so this is a new regression, not a
  carried one.
- NOTED (not done, out of #710's scope — merged in #724): `e2e/server-watchdog-reporter.ts:57`
  calls `process.exit(1)`, which skips Playwright's `test.afterAll`. If the dev server dies during
  `e2e/event-registrations-auth.spec.ts`, its cleanup (`:164-171`) never runs and the seeded event,
  share links and registrations are orphaned in the shared DEV project.
- NOTED (not done, out of #710's scope — merged in #721): `types/supabase.ts:2370` types the
  `get_event_registrations_for_viewer` returns `email`, `profile_id`, `sharer_name`, `attended_at`
  and `cancelled_at` as non-nullable `string`, but all five are NULL in normal operation. The
  current caller casts to `EventRegistration` (correctly nullable); the next caller that trusts the
  generated type dereferences a null with no compiler warning.
- NOTED (not done, found during #709): the DEV ledger has NO `20260809000100` row (#706
  `fn_schedule_guest_reminders_record`), though prod does. Function-body-only, so
  `types/supabase.ts` is unaffected, but hosted DEV may be running the pre-#706 body. This matters
  for #710: the D2 reminder claim depends on `COALESCE(gr.email, p.contact_email)` being live.
- NOTED (not done, local env only): `GET /api/calendar/feed-token` 500s locally with
  "NEXT_PUBLIC_APP_URL is not set" (`lib/utils/base-url.ts:12`). Pre-existing local env gap.
- NOTED (not done): `e2e/profile-bento-auth.spec.ts:72` ("reset layout") fails when the shared DEV
  member profile carries leftover collapse state from an interrupted run. Order/state-dependent,
  not a code defect; worth its own ticket.
- NOTED (not done, declined CodeRabbit finding on #720, needs its own ticket): client error copy is
  selected by matching ENGLISH server text — `MemberAttendPanel.tsx:73-78` and
  `app/(dashboard)/calendar/components/EventPopup.tsx:76-78` both do `raw.includes('capacity')`.
  A real fix needs a machine-readable `code` on `attendEvent`'s failure result, through
  `app/api/events/[id]/attend/route.ts`, surfaced on `ApiError` (`lib/apiClient.ts:13`).
- NOTED (not done, found during #708): a signed-in member blocked by a FULL event still gets
  `ResendLinkForm` — the guest magic-link resend — at `app/events/[eventId]/register/page.tsx:179`
  and `:216`. Wrong flow for a portal identity; pre-existing blocked branch.
- NOTED (not done): `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`)
  still has the detached-anchor + synchronous-`revokeObjectURL` pattern fixed in
  `AddToCalendarMenu.tsx` — same latent no-file-downloaded bug in Firefox/Safari. Needs its own ticket.
- NOTED (not done): `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders`
  (does not exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still
  the pre-#705 column list.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  #710 moves that read-then-write shape into the helper; it does NOT close the race.
- **#713/#714/#715** (unclaimed, from #706).
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not deferred:
  `playwright.config.ts` never sets `fullyParallel`, so Playwright 1.61 parallelizes by FILE. Do not
  "fix" this later.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all 4
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
