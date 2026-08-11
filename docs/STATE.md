## Goal
PLAN + CLAIM + BUILD issue #718 (2608-DEV-718) on branch `dev/2608-DEV-718` — `guest_capacity` has a
check-then-write race: nothing in the DB backs the cap, so concurrent registrations overbook it.

## Now
#718 is **pushed and open as PR #732**, CI green on `0e64f9a` (11/11 checks, Vercel preview READY),
`MERGEABLE` / `CLEAN`, not a draft. CodeRabbit's one pass left three findings — all three are now
dispositioned (see `## Decisions`); one produced a real change to the migration, two were declined
with evidence. GCR has not run. The fix is a `BEFORE INSERT OR UPDATE` trigger on
`guest_registrations` — `20260811000100_2608_fix_718_guest_capacity_trigger.sql` — rather than the
RPC the issue suggested, because #710 added a fourth writer inside `approve_event_role_request` and
a trigger sits under all of them. Both server paths map its SQLSTATE `P0718` back onto the friendly
"event is full" copy via `isCapacityViolation()`.

Verified so far: `npx vitest run lib/actions/guest-registration.test.ts
lib/server/member-registration.test.ts` -> 64 passed (baseline was 56). The 5 new P0718 tests were
proven red first by breaking `CAPACITY_VIOLATION_CODE`. `npx tsc --noEmit` is clean outside `.next/`.

**The race is proven closed on DEV.** `supabase db push --linked` applied `20260811000100` (and two
already-merged migrations DEV was missing, `20260805000000` + `20260809000100`). Eight serial
behaviour checks pass. The concurrency proof came from **two pg_cron workers** scheduled on the same
tick, not from two client connections: the MCP serializes its calls, so a parallel-call attempt
returned `blocked_for=5ms` and proved nothing. Under pg_cron the two workers started 0.6ms apart —
B won the advisory lock and committed at `.123`, A blocked ~79ms on that lock, re-counted, saw B's
committed row and raised P0718 at `.1266`. Exactly 1 active row against `guest_capacity = 1`. That
blocking signature is the fresh-snapshot-after-lock property the whole fix depends on.

Both review gates are CLOSED (2026-08-12). Pushed `0e64f9a..16cac3b` on an explicit grant; CI green
again on `16cac3b` (11/11, `Replay migrations from scratch` 2m15s — which is what proves the edited
PL/pgSQL is valid from an EMPTY database, not merely as an in-place `CREATE OR REPLACE`).
`Authenticated E2E (Clerk)` came back in **6m7s vs 13m1s** on the previous run, consistent with the
sign-in race no longer burning a retry cycle. All three CodeRabbit threads resolved; its re-review
added nothing.

**DEV was re-applied by hand** and matches the file. `db push` could not do it — the version was
already in the DEV ledger, so it skips — the new body went in as `CREATE OR REPLACE FUNCTION` via
the Supabase MCP against `iymwxdewcpvpjgzewtzk`, trigger untouched (`has_new_guard=true`,
`trigger_count=1`). **Reusable technique:** a probe that must leave no trace can run its whole
fixture set inside one `DO $$ … $$` block and end with `RAISE EXCEPTION` carrying the results in the
message — the raise rolls every fixture back, and the MCP surfaces the message as the error string.
Verified 0 probe events / 0 probe registrations afterwards.

**Open gate: merge + prod.** #718 ships a migration, so merging arms the gated `migrate-prod` run.

#715 is **merged**: PR #731 (`ddaa2e5`), no migration, no prod gate. #714 merged (`c6ba2f2`).
#713 merged (`2f82d80`). #710 fully DONE — prod ledger head `20260811000000`.

## Next
1. DONE — applied to DEV.
2. DONE — all eight serial checks plus the pg_cron concurrency proof pass; every fixture rolled back
   or deleted, DEV left clean (0 probe events, 0 probe registrations, 0 leftover cron jobs).
   **Reusable technique:** when two truly concurrent transactions are needed against a hosted DB and
   no DB password is at hand, schedule two `cron.schedule(...)` jobs on the same tick and read the
   outcome out of `cron.job_run_details` — the MCP cannot do it, it serializes its calls.
3. DONE — no e2e impact. Every fixture creator omits `guest_capacity` (NULL = unlimited). The one
   spec that caps an event, `e2e/member-share-register-auth.spec.ts:229-253`, writes no registration
   while capped (it only reloads a read-only page), and `calendar_events` updates do not fire the
   trigger.
4. DONE — reviewed, pushed, PR #732 opened and marked ready; CI green, preview READY.
5. DONE — CodeRabbit's single pass returned three findings; all three answered on the thread and
   fixed-or-declined in one batch (2026-08-12).
6. DONE — pushed `16cac3b`; CI green 11/11 including `Replay migrations from scratch`.
7. DONE — DEV re-applied by hand and behaviour-probed (edit-active ALLOWED, adopt-active ALLOWED,
   new-seat-on-full REFUSED P0718), DEV left clean.
8. DONE — all three CodeRabbit threads resolved; one correction posted where its verifier read the
   pre-push revision and reported the fix missing.
9. **Merge** -> GCR. The claim row is already pruned in this PR's own commits, so GCR is
   issue-close (#718) + branch cleanup only.
10. After merge: approve the gated `migrate-prod` run — **#718 ships a migration**, unlike the last
   four tickets. Prod ledger head should move `20260811000000` -> `20260811000100`. Then smoke
   `https://www.teamenjoyvd.com`.
11. Follow-ups filed and unclaimed: **#733** (machine-readable failure code, retires the English
   error-text matching) and **#734** (seven e2e specs still carrying the sign-in race).
7. Still open from #715: five call sites silently skip on a null `contact_email`
   (`lib/abo/verifyAbo.ts:226`, both spouse-link routes, `app/api/admin/members/verify/[id]/route.ts:99`,
   `lib/server/member-registration.ts`) — a shared `resolveProfileEmail()` would fix all six.

## Open items
- `.next/dev/types/validator.ts:566` references `app/api/admin/events/[id]/registrations/route.js`,
  a route that no longer exists, so `npx tsc --noEmit` exits non-zero on a clean tree. Proven
  pre-existing by stashing (2026-08-11). Stale build artifact, not a source defect; out of #718's
  scope.

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions do
  not carry over.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#718, from PLAN): a **trigger, not the RPC the issue proposed**. #718 was filed before
  #710, which added a fourth writer of active registrations inside `approve_event_role_request`
  (`20260811000000:99-142`) — an RPC would have to absorb the guest token-reuse decision, the member
  adopt-or-insert branch, and re-entry from another PL/pgSQL function. A trigger sits under all of
  them plus the e2e/seed direct inserts, and cannot be defeated by forgetting to call it, which is
  what the issue actually asked for.
- DECISION (#718, from BUILD): the app-level `countAttendeesForCapacity()` checks **stay**. They are
  the fast path that produces the localized "event is full" copy; the trigger is the backstop for
  the window they cannot cover. Cost accepted: the "who occupies a seat" rule (approved role holders
  exempt) now exists in two places and must be changed in both — flagged in `docs/ai/GOTCHAS.md`.
- DECISION (#718, from BUILD): custom SQLSTATE **`P0718`**, not a 23xxx integrity code.
  `guest_registrations` carries real CHECK and UNIQUE constraints, so matching a shared class would
  report an unrelated violation to a guest as "event is full".
- DECISION (#718, from BUILD): the trigger function is `SECURITY DEFINER` with **no internal
  `auth.role()` guard**, departing from the `docs/ai/GOTCHAS.md` "Trusted RPC" rule. That rule
  guards directly-callable functions; Postgres refuses to invoke a `trigger`-returning function
  outside a trigger context, so there is no caller to authorize. DEFINER is used only so the count
  is computed over every row rather than an RLS-filtered view, which could under-count. EXECUTE is
  deliberately not revoked — trigger-function privileges are checked at CREATE TRIGGER time, and
  revoking would risk the write paths for no gain.
- DECISION (#718, from REVIEW): CodeRabbit's 🟠 "enforce capacity when an active row changes
  exemption status" is **unreachable today but was fixed anyway**. The overbooking it describes
  needs an UPDATE moving `profile_id` off an approved role holder on an already-active row; every
  writer that sets `profile_id` requires the pre-image to be NULL
  (`member-registration.ts:255` `.is('profile_id', null)`, `20260811000000:112`
  `g.profile_id IS NULL`), and `registerGuest`'s upsert never names the column — NULL -> non-NULL
  only moves a row toward exempt, which under-counts and cannot overbook. Accepted anyway because
  the trigger's whole premise is surviving a writer nobody has written yet: the early return now
  also requires `OLD.profile_id IS NOT DISTINCT FROM NEW.profile_id`. Safe for the adopt paths that
  do fall through — `gr.id <> NEW.id` excludes the row's own already-counted seat, so adopting the
  last guest on an exactly-full event still passes.
- DECISION (#718, from REVIEW): CodeRabbit's 🟠 "localize the member capacity error" is **DECLINED —
  the proposed fix is a regression.** `CAPACITY_ERROR` is not new (`git diff origin/main` shows the
  same English string at `:218` before this PR); it is a server->client protocol matched by
  `MemberAttendPanel.tsx:75` and `EventPopup.tsx:79` via `raw.includes('capacity')`. Returning
  Bulgarian when `lang === 'bg'` makes BOTH matchers miss and fall through to the generic attend
  error — strictly worse for the Bulgarian user the finding is about. The same finding was declined
  on #720 for the same reason; the real fix is the machine-readable `code` already logged under
  Open items, now filed as **#733** `[2608-DEV-733]`.
- DECISION (#718, from REVIEW): CodeRabbit's 🟡 test-fidelity finding was **correct and taken**.
  `member-registration.test.ts`'s ADOPT P0718 test seeded `cancelled_at: null`, and the trigger
  returns at `:79` for an active same-event pre-image, so it asserted on a rejection the database
  cannot produce. Now seeds a cancelled row — the one adoption shape that genuinely re-seats a
  registrant, since the adopt lookup does not filter on `cancelled_at`
  (`member-registration.ts:250-256`).
- DECISION (#715, from PLAN): sharer notifications are **notifications, not transactional mail** —
  they now dispatch through `sendNotificationEmail`, so `email_config.enabled` and the per-template
  toggle both apply. The sharer did not request each message. Consequence accepted: flipping the
  master switch off silences sharer mail too. Guest magic links stay transactional.
- DECISION (#715, from PLAN): fallback order is `contact_email` → **Clerk primary email**, not the
  issue's option 2 (require `contact_email` before minting a share link). `contact_email` is a
  preference and may be deliberately blank; Clerk's primary is the verified backstop. Profiles with
  no `clerk_id` (admin-created spouse/co-owner rows) keep the silent skip — no address exists.
- DECISION (#715, from PLAN): the cap bucket is **template-scoped**, unlike
  `guest-event-changes.ts`'s recipient-wide bucket — a registration burst through a viral link must
  not consume the budget that would otherwise deliver the cancellation notice. 10 per 24h.
- DECISION (#715, from BUILD): **no migration.** Keys absent from
  `notification_config.email_settings.notification_types` already pass the gate
  (`lib/email/send.ts:131` compares `=== false`), so the three admin toggles need no seed row — the
  panel writes the key on first toggle.
- DECISION (#713, from PLAN): the issue's **option 1** (resolve before any write), not option 2
  (degrade after). The `feed.ics` precedent at `:59-64` degrades *after* the point of no return
  because a feed has nothing to commit; `registerGuest` does. Hoisting is strictly better: the guest
  either registers and gets a link, or gets a clear error and is not silently half-signed-up.
- DECISION (#713, from PLAN): the Vercel fallback is a **positive allowlist** on
  `VERCEL_ENV === 'preview' | 'development'`, never `!== 'production'` — an unset or unknown
  `VERCEL_ENV` must not enable it. Production keeps the throw: a `*.vercel.app` magic link in a
  member's inbox is unbranded and phishing-shaped, and a prod misconfig should stay loud.
- DECISION (#713, from PLAN): `VERCEL_PROJECT_PRODUCTION_URL` is **omitted**. It did not appear in
  the Vercel docs search, and an unverified env var name is a guess.
- DECISION (#713, from PLAN): `.env.example` keeps `NEXT_PUBLIC_APP_URL` **optional**. Promoting it
  to required would fail `npm run check:env` on the local box for no gain once the fallback exists.

## Facts
- BASELINE 2026-08-11 on `dev/2608-DEV-713@f8f3a3f`:
  `npx vitest run lib/actions/guest-registration.test.ts lib/utils/base-url.test.ts lib/server/member-registration.test.ts`
  -> 3 files / **57 passed**. Full `npx vitest run` -> 32 files / **423 passed**. `npx eslint .` ->
  **0 errors / 465 warnings**. `npx tsc --noEmit` -> **1 error**, STALE GENERATED OUTPUT:
  `.next/dev/types/validator.ts(566,39)` still references the route deleted by #709. Not a source
  error; expect it until `.next` is regenerated.
- Vercel system env vars confirmed against the Vercel docs: `VERCEL_ENV`, `VERCEL_URL`,
  `VERCEL_BRANCH_URL` — all bare hostnames with no scheme, available at build AND runtime.
  `VERCEL_PROJECT_PRODUCTION_URL` was NOT confirmable and is deliberately unused.
- The member path already carried the #713 fix: `lib/server/member-registration.ts:62-104` wraps the
  whole confirmation send in `try/catch`, and `lib/server/member-registration.test.ts:527` is named
  `'never fails the attend when the link builder throws (#713 shape)'`. #713 was guest-path-only.
- `getBaseUrl` call sites, all dispositioned in the #713 reference sweep:
  `lib/actions/guest-registration.ts` (updated), `lib/server/member-registration.ts:74`,
  `app/api/calendar/feed.ics/route.ts:64`, `app/api/calendar/feed-token/route.ts:21,45,81`,
  `app/api/profile/spouse-link/route.ts:138` (all unaffected — each consumes the returned string).
- Production smoke 2026-08-11: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- #715 PLAN + CLAIM + BUILD (code complete, `6a3b29f` + the review fix) — RESULT: 6 files.
  `lib/notifications/share-events.ts` gained `resolveSharerEmail` (contact_email → Clerk primary,
  Clerk failure caught) and `sendShareNotification` (admin gates, then a template-scoped 10/24h
  `consumeEmailCap`, then `sendNotificationEmail`); `EmailSettingsPanel.tsx` + `i18n/domains/admin/
  content.ts` expose the three toggles; `lib/email/send.ts` JSDoc lists the new caller. `/code-review
  low` found one real defect — the cap was spent BEFORE the gates, so a disabled template burned the
  sharer's daily budget; fixed by re-checking `getEmailConfig()` ahead of `consumeEmailCap`, covered
  by two new tests. Verified: `npx vitest run` -> 32 files / **443 passed** (baseline 441 on this
  branch's parent + 2); `npx tsc --noEmit` -> only the pre-existing stale `.next` error;
  `npx eslint` on the changed files -> clean.
- #714 CLOSED — RESULT: merged as PR #729 (`c6ba2f2`), no migration, no prod gate.
- #713 BUILD (code complete, `a97a7df`) — RESULT: 5 files. `lib/utils/base-url.ts` gained a
  `normalizeHost` helper + the preview/development Vercel fallback; `lib/actions/guest-registration.ts`
  hoists the resolve above every side effect in BOTH `registerGuest` and `resendGuestLink`;
  `.env.example` documents the fallback. Verified: `npx vitest run` -> 32 files / **433 passed**
  (baseline 423 + 10 new); `npx eslint .` -> 0 errors / 465 warnings (baseline 465);
  `npx tsc --noEmit` -> only the pre-existing stale `.next` error.
- #713 PLAN + CLAIM — RESULT: verdict READY; issue body carries the DoD, affected files, and four
  PLAN corrections (member path already fixed; option 1 over option 2; fallback excludes production;
  `.env.example` stays optional); Design Checklist 4/4; `## Branch dev/2608-DEV-713`; claim row
  committed at `f8f3a3f` with the merged #710 row pruned in the same commit.
- #702 epic updated — RESULT: all ten children (#703-#710) marked merged with their PR numbers, the
  "In flight"/"Ready to pick" sections collapsed, and a new "Follow-ups discovered during this epic"
  section lists #713 (in flight) plus unclaimed #714, #715, #718, #726, #727. The epic's feature
  scope is complete; the follow-ups explicitly do not block closing it.
- #710 CLOSED — RESULT: merged as PR #725 (`17fd786`); gated `Migrate Prod` run 31471066200 approved
  by the user and succeeded (`Applying migration 20260811000000_...` -> `Finished supabase db push`,
  ledger head after push `20260811000000`); production smoke 200/200. The #710 GCR fix (adopt
  exactly one guest row under a `LOWER()` match, via a scalar subquery with
  `ORDER BY g.created_at, g.id LIMIT 1`) is live in prod. LESSON from that review: a set-returning
  predicate under a unique index needs its own LIMIT — a `NOT EXISTS` guard only covers a
  PRE-EXISTING row, never multiple matches inside the same UPDATE.
- #709 closed — RESULT: merged as PR #721 (`9288601`); tiered Registrations tab live.
- #708 closed — RESULT: merged as PR #720 (`a11b89d`).
- #722 closed — RESULT: merged as PR #724 (`ef0c3e1`), E2E aborts on a dead dev server.

## Open items
- NOTED (not done, same-class defect, out of #715's scope): `lib/email/send.ts:129` still reads
  `if (!config.enabled) return` — the exact check #715 tightened to `!== true` at
  `share-events.ts:135`. `enabled` is typed `boolean` but comes from a JSONB column through an
  `as EmailConfig` cast (`send.ts:35`), so a malformed row holding `"true"` or `1` makes the master
  kill switch fail OPEN there. Repo-wide sweep found exactly one remaining instance (the two
  `EmailSettingsPanel.tsx` hits are display-only toggles). One-line fix, needs its own ticket.
- FLAKE (2026-08-11, PR #731, not a spec defect): the `Authenticated E2E (Clerk)` job failed with 21
  tests red across `payments-guest`, `payments-on-behalf`, `profile-bento-auth` and the 390px share
  specs — every one at `clerk.signIn()`, with 5x `[Clerk Testing] FAPI request failed after 4
  attempts` against `loved-mole-75.clerk.accounts.dev`. No assertion ever ran. The run took 18m25s
  because 60s timeout x retry x ~10 tests, vs a 6m baseline. Re-run of the SAME commit passed in
  5m50s. Clerk's dev FAPI was transiently down; do not "fix" this in the specs.
- FIXED (2026-08-12, in PR #732) — a DIFFERENT flake from the one above, and a real spec defect:
  `payments-on-behalf.spec.ts:169` went red on run 31532749854 with 30s of "element(s) not found"
  for a button that only exists on `/profile`. Cause: `clerk.signIn()` resolves on
  `waitForFunction(() => window.Clerk?.user !== null)` (@clerk/testing 2.2.7) — an in-memory CLIENT
  signal — while `proxy.ts:14-21` authorises `/profile` SERVER-side from the session cookie and
  answers `NextResponse.redirect('/sign-in')` when it cannot resolve a userId. A `goto` on the next
  line can be decided against a cookie the browser has not finished writing, and the test then fails
  naming the missing element rather than the redirect that actually happened. Fixed by
  `e2e/auth-helpers.ts` (`gotoProtected` re-navigates until the path sticks — a retry loop, not
  `expect.poll`, because a cold Turbopack compile can make a SUCCESSFUL goto take ~80s and a poll
  deadline would abort it). Both payments specs adopted it; they were byte-identical and carried the
  identical bug.
- NOTED (not done, out of #718's scope, FILED as **#734** `[2608-DEV-734]`): seven other e2e specs still do
  `clerk.signIn()` followed by a navigation without waiting for the server to honour the session —
  `profile-bento-auth.spec.ts:34-35` (`/profile`, the same shape as the two fixed specs),
  `member-attend-auth.spec.ts:127,179,227`, `event-registrations-auth.spec.ts:232,250,268,287`,
  `admin-auth.spec.ts:24`, `admin-mobile-auth.spec.ts:57`, `member-share-register-auth.spec.ts:150`,
  `los-submission-auth.spec.ts:41`. Deliberately NOT converted inside #718 — an unrelated
  cross-cutting e2e change does not belong in a capacity-trigger PR, and `profile-bento-auth` in
  particular has its own diagnosed cause in #727 (401 eviction after `page.reload()`) that this
  helper would mask rather than fix.
- CI (2026-08-12, in PR #732): the authenticated-E2E artifact upload was gated on `failure()`, but
  `retries: 1` means a flaky spec passes on attempt 2 and the JOB goes green — throwing away the
  trace for the one run with something to explain, which is exactly what happened to the flake
  above. Now `!cancelled()` with `if-no-files-found: ignore`.
- NOTED (not done, out of #713's scope): `app/api/calendar/feed-token/route.ts:21,45,81` and
  `app/api/profile/spouse-link/route.ts:138` still `await getBaseUrl()` unguarded. Neither commits
  irreversible state first, so neither has the #713 half-success shape — they just 500 on a
  misconfigured environment, which the Vercel fallback now prevents on previews. No ticket filed.
- NOTED (not done, same-class defect found by `/code-review medium` on #710): the case-sensitive
  email match fixed in the #710 RPC also exists in TypeScript at
  `lib/server/member-registration.ts:239` — `.eq('email', contactEmail)` in `attendEvent`'s D9
  adopt step. A member who signed up as `Ivan@Example.com` is not adopted and gets a second row.
  Fixing it needs either a citext/lower() index or a `.ilike()` lookup — its own ticket.
- **#726** `[2608-DEV-726]` `bug` (unclaimed, FILED 2026-08-11 from the #710 review): `EventPopup.tsx:156`'s
  `showMeta = activeTab !== 'registrations'` now applies to EVERY role, and
  `EventPopupShell.tsx:169-214` puts `AttendSection` + the share/QR buttons inside that gate. A
  member who opens the Registrations tab loses the Attend button with no affordance explaining why.
  A new regression from #721, not a carried one.
- **#727** `[2608-DEV-727]` `bug` `priority:high` (unclaimed, FILED 2026-08-11): a transient 401 while
  Clerk refreshes the session token makes `lib/apiClient.ts:29-33` set
  `window.location.href = '/sign-in'`, evicting a still-valid session. PROVED from the PR #725
  Playwright traces: a 5-endpoint 401 burst at t=180726ms right after `page.reload()`, then
  `200 GET /api/profile` 7ms later, then the `/sign-in` navigations. This — NOT leftover collapse
  state — is what makes `e2e/profile-bento-auth.spec.ts` intermittently red (`:72` and `:154`).
  Supersedes the earlier "order/state-dependent" note, which was a wrong diagnosis.
- **#718** `[2608-DEV-718]` `bug` (unclaimed): capacity-check TOCTOU race, same shape in
  `guest-registration.ts` and `member-registration.ts` — no DB-level guard on `guest_capacity`.
  #710 moved that read-then-write shape into the helper; it does NOT close the race.
- **#714** `[2608-DEV-714]` `chore` `priority:high` (docs mislabel the prod Supabase ref) and
  **#715** `[2608-DEV-715]` `bug` (sharer notifications: no `contact_email` fallback, no email cap)
  — both unclaimed, both from #706.
- NOTED (not done, out of scope — merged in #724): `e2e/server-watchdog-reporter.ts:57` calls
  `process.exit(1)`, which skips Playwright's `test.afterAll`. If the dev server dies during
  `e2e/event-registrations-auth.spec.ts`, its cleanup (`:164-171`) never runs and the seeded event,
  share links and registrations are orphaned in the shared DEV project.
- NOTED (not done, out of scope — merged in #721): `types/supabase.ts:2370` types the
  `get_event_registrations_for_viewer` returns `email`, `profile_id`, `sharer_name`, `attended_at`
  and `cancelled_at` as non-nullable `string`, but all five are NULL in normal operation. The
  current caller casts to `EventRegistration` (correctly nullable); the next caller that trusts the
  generated type dereferences a null with no compiler warning.
- NOTED (not done, found during #709): the DEV ledger has NO `20260809000100` row (#706
  `fn_schedule_guest_reminders_record`), though prod does. Function-body-only, so
  `types/supabase.ts` is unaffected, but hosted DEV may be running the pre-#706 body.
- NOTED (FILED 2026-08-12 as **#733** `[2608-DEV-733]`; declined CodeRabbit finding on #720 AND
  again on #732): client error copy is
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
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not deferred:
  `playwright.config.ts` never sets `fullyParallel`, so Playwright 1.61 parallelizes by FILE. Do not
  "fix" this later.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all 4
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
