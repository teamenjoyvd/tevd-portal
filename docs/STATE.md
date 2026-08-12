## Goal
PLAN + CLAIM + BUILD #727, #733 and #734, resolve findings along the way, and push each to an
open DRAFT PR. All three were filed as follow-ups from the #726/#718 work and were unclaimed.

## Now
All three are built and pushed as draft PRs, cut from `main` at `ff55ad2`:
- **#727 -> PR #736** (`dev/2608-DEV-727`) — transient-401 fix. **11/11 checks green**, incl.
  `Authenticated E2E (Clerk)` 6m48s (a real run) and Vercel "Deployment has completed".
- **#733 -> PR #737** (`dev/2608-DEV-733`) — attend failure code. CI running at hand-off.
- **#734 -> PR #738** (`dev/2608-DEV-734`) — e2e sign-in race. CI running at hand-off.

## Next
1. Watch CI + Vercel preview on #737 and #738; fix anything red.
2. Merge order is **#736 -> #737 -> #734's PR**. #736 and #737 both touch `lib/apiClient.ts`
   (different hunks: #736 the 401 branch, #737 `ApiError` + the JSON error parse), so rebase
   `dev/2608-DEV-733` onto `main` after #736 merges. They are compatible by construction — `code`
   is `ApiError`'s OPTIONAL third parameter, so #736's `new ApiError(401, 'Unauthorized')` calls
   stay valid untouched.
3. Per PR: mark ready -> ONE CodeRabbit pass -> fix findings in ONE batched push. CodeRabbit's
   CHECK says "skipped" on drafts but it can still post inline comments — always fetch
   `pulls/N/comments`, never trust the check (it did exactly this on #735).
4. GCR each merge: prune its `docs/CLAIMS.md` row, close the issue. **No migrations in any of the
   three**, so no prod gate for this batch.
5. **STILL OPEN FROM #718:** PR #732 merged as `4ac7228` and SHIPPED A MIGRATION, so the gated
   `migrate-prod` run is armed and unapproved. Prod ledger head must move `20260811000000` ->
   `20260811000100`, then smoke `https://www.teamenjoyvd.com`. Until then prod has the app code
   that raises `P0718` but not the trigger that produces it (harmless — the app-level check still
   guards — but the race is closed only on DEV).

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions
  do not carry over. (This session's grant: "PUSH TO OPEN DRAFT PR 727, 733 and 734".)
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#727): take the issue's fix 1 (refresh + replay) and get its fix 2 free — `getToken()`
  returns `null` for a genuinely signed-out user, so ONE call both forces the refresh and
  distinguishes a real expiry from a refresh race. A thrown Clerk error (offline, load timeout) is
  explicitly NOT a sign-out and must not evict the session.
- DECISION (#727): the single-flight promise and the redirect latch live at MODULE scope. The burst
  is concurrent, so the decision must be shared; five independent decisions means the first loser
  still evicts everyone. The latch is deliberately never reset — it is set on the line before a
  full-page navigation that discards the module.
- DECISION (#733): put a code on EVERY failure return, not only the three the issue named. A
  partial discriminant leaves the client guessing from text for the rest, which is the defect being
  removed. `error` stays English developer/log copy; `t()` on the client still owns display copy.
- DECISION (#734): `gotoProtected` covers protected PAGE navigations only. Two spec shapes have no
  protected page to land on — API-only (`los-submission`, and `admin-auth`'s `page.request` cases)
  and PUBLIC target pages (`/events/:id/join`, `/events/:id/register`). Both got
  `waitForServerSession()` in `e2e/auth-helpers.ts`: the same "wait until proxy.ts can resolve the
  session" idea, observed by polling `/api/profile` until it stops answering 401.

## Facts
- `getToken` IS exported from `@clerk/nextjs` v7.5.15 (re-export of `@clerk/shared/getToken`
  v4.25.2): `dist/types/index.d.ts:16`, `dist/esm/index.js:56,96`, `dist/cjs/index.js:66,128`, and
  `require('@clerk/nextjs').getToken` is a `function`. A `/code-review low` pass claimed otherwise
  and was wrong — verify at runtime, do not re-litigate this from memory.
- Every 401 the browser can receive from `app/api/**` is a PRE-side-effect auth guard (`proxy.ts:19`
  plus `if (!userId) return 401` at the top of each handler, 40+ sites swept), which is what makes
  replaying a failed POST safe.
- Zero `Authorization` headers exist in `app/` or `lib/` — auth is cookie-based. The only hits are
  Supabase edge functions (server-side).
- `InvalidState reason="missing"` on `/events/:id/join` renders `event.join.linkInvalid` =
  "This link is invalid." — the same screen an anonymous visitor gets.
- `playwright.config.ts` never sets `fullyParallel`: Playwright parallelizes by FILE, so tests in
  one spec share a worker and DB state in declaration order.
- `EventActionsTabs` sets an explicit `role="tab"`, which OVERRIDES `<button>`'s implicit role —
  `getByRole('button')` matches nothing there.
- Authenticated e2e cannot run against `.env.local` (PROD credentials). Use the DEV override
  (`iymwxdewcpvpjgzewtzk`). A cold dev server makes local authenticated runs untrustworthy — only a
  warm-server run is evidence.
- Baseline before this session's work: `npm test` 32 files / 451 tests, `npx tsc --noEmit` clean.

## Done
- #727 BUILD — RESULT: `lib/apiClient.ts` + new `lib/apiClient.test.ts` (8 cases). Proven red
  first: with the fix stashed 5 of 8 fail; restored, 8/8. `npm test` 33 files / 459 tests,
  tsc + eslint clean. PR #736 draft, 11/11 green.
- #733 BUILD — RESULT: `AttendFailureCode` on every failure return, `{ error, code }` from the
  attend route, `ApiError.code`, both client surfaces switched over, `docs/ai/REF.md` row updated.
  Zero `.includes('capacity')`/`.includes('already ended')` left under `app/`. Tests proven red
  first (9 of 31 fail with the source stashed), then 31/31; `npm test` 452 passed; `/code-review
  low` zero findings. PR #737 draft.
- #734 BUILD — RESULT: all seven specs converted, plus `waitForServerSession` /
  `signInAndWaitForSession` added to `e2e/auth-helpers.ts`. tsc + eslint clean, Playwright lists
  35 tests in 9 files. PR #738 draft.
- #726 MERGED as PR #735 -> `ff55ad2`. #718 merged as `4ac7228` (prod migration gate still
  unapproved — see Next 5). #715 (#731), #714, #713, #710, #709, #708, #722 merged.

## Open items
- Still open from #715: five call sites silently skip on a null `contact_email`
  (`lib/abo/verifyAbo.ts:226`, both spouse-link routes,
  `app/api/admin/members/verify/[id]/route.ts:99`, `lib/server/member-registration.ts`) — a shared
  `resolveProfileEmail()` would fix all six.
- NOTED (same-class as #715): `lib/email/send.ts:129` still reads `if (!config.enabled)`, the exact
  check #715 tightened to `!== true`. `enabled` comes from JSONB through an `as EmailConfig` cast,
  so a row holding `"true"` or `1` makes the master kill switch fail OPEN. Repo-wide sweep: exactly
  one instance left. One-line fix, needs its own ticket.
- NOTED (from #726 GCR): `scripts/check-env.js` has no regression tests — it runs side effects at
  require time including `process.exit`, so testing it needs the resolver extracted into a module.
  Needs its own ticket.
- NOTED (same-class, from #710): the case-sensitive email match fixed in the #710 RPC also exists in
  TypeScript at `lib/server/member-registration.ts` — `.eq('email', contactEmail)` in `attendEvent`'s
  D9 adopt step. `Ivan@Example.com` is not adopted and gets a second row. Needs `citext`/`lower()`
  or `.ilike()`. Its own ticket.
- NOTED: `app/api/calendar/feed-token/route.ts:21,45,81` and `app/api/profile/spouse-link/route.ts:138`
  still `await getBaseUrl()` unguarded. Neither commits irreversible state first, so neither has
  #713's half-success shape. No ticket filed.
- NOTED: `e2e/server-watchdog-reporter.ts:57` calls `process.exit(1)`, skipping Playwright's
  `test.afterAll` — if the dev server dies during `event-registrations-auth.spec.ts`, its cleanup
  never runs and seeded rows are orphaned in the shared DEV project.
- NOTED: `types/supabase.ts:2370` types five `get_event_registrations_for_viewer` returns as
  non-nullable `string` while all five are NULL in normal operation.
- NOTED: a signed-in member blocked by a FULL event still gets `ResendLinkForm` (the guest magic-link
  resend) at `app/events/[eventId]/register/page.tsx:179` and `:216` — wrong flow for a portal identity.
- NOTED: `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`) still has the
  detached-anchor + synchronous-`revokeObjectURL` pattern fixed in `AddToCalendarMenu.tsx`.
- NOTED: `docs/ai/REF.md` §6 Edge Functions table lists `send-event-reminders` (does not exist) and
  omits `deliver-email-notifications`; §5's `guest_registrations` row is the pre-#705 column list.
- FLAKE (not a spec defect): `Authenticated E2E (Clerk)` can fail wholesale at `clerk.signIn()` with
  `[Clerk Testing] FAPI request failed after 4 attempts` — Clerk's dev FAPI being transiently down.
  Re-run the same commit; do not "fix" it in the specs.
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not deferred
  (see the `fullyParallel` fact). Its "localize the member capacity error" was declined twice for the
  right reason — #733 is the real fix.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all four
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
