## Goal
Land PR #738 (issue #734, branch `dev/2608-DEV-734`): resolve its conflicts with `main`, refresh
`docs/STATE.md` + `docs/CLAIMS.md`, mark it ready so CodeRabbit runs, then apply GCR.

## Now
PR #738 is the ONLY open PR and is READY TO MERGE. It sat `CONFLICTING` because #736 and #737
merged after it was cut; `origin/main` (`32791a9`) is merged into the branch at `30c2744`. The only
conflicts were `docs/STATE.md` and `docs/CLAIMS.md` — no `e2e/**` file conflicted. On `30c2744`:
`MERGEABLE`, not a draft, 11/11 checks green (`Authenticated E2E (Clerk)` 5m49s, a real run) and
Vercel "Deployment has completed".
GCR is DONE and empty: CodeRabbit's first attempt returned "Review rate limited" (which says nothing
about the code — the same non-review it gave #737); re-triggered with an `@coderabbitai review`
comment after the limit reset, it reviewed all 8 `e2e/**` files and returned **"No actionable
comments"** — verified by fetching `pulls/738/comments` (0) and `pulls/738/reviews` (0), not by the
check status. `docs/**` is excluded from its review by `.coderabbit.yaml` path filters.

## Next
1. Merge PR #738; #734 auto-closes via "Closes #734". Its `docs/CLAIMS.md` row is pruned in this PR
   itself, leaving the registry empty. **No migration in this ticket** — no prod gate, no
   `migrate-prod` approval needed.
2. Nothing else is in flight. The next ticket comes from the Open items below.

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions
  do not carry over. (This session's grant: "PR 738, resolve the conflicts … Mark ready to get
  coderabbit to run and apply GCR once that happens".)
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#734): `gotoProtected` covers protected PAGE navigations only. Two spec shapes have no
  protected page to land on — API-only (`los-submission-auth`, and `admin-auth`'s `page.request`
  cases) and PUBLIC target pages (`/events/:id/join`, `/events/:id/register`, both in
  `PUBLIC_ROUTE_PATTERNS`). Both got `waitForServerSession()` in `e2e/auth-helpers.ts`: poll
  `/api/profile` until it stops answering 401. Any non-401 settles it — a 404 still proves Clerk
  resolved the user.
- DECISION (#734): `profile-bento-auth` is converted because issue #734 lists it, but its known red
  is #727's transient-401 eviction (fixed by PR #736) — a different bug on a different layer.

## Facts
- Prod migration ledger head is `20260811000100`, verified 2026-08-12 against project
  `ynykjpnetfwqzdnsgkkg` — #718's migration IS applied on prod. Do not re-raise it as pending.
- `playwright.config.ts` never sets `fullyParallel`: Playwright parallelizes by FILE, so tests in
  one spec share a worker and DB state in declaration order.
- Authenticated e2e cannot run against `.env.local` (PROD credentials). Use the DEV override
  (`iymwxdewcpvpjgzewtzk`). A cold dev server makes local authenticated runs untrustworthy — only a
  warm-server run is evidence.
- `getToken` IS exported from `@clerk/nextjs` v7.5.15 (re-export of `@clerk/shared/getToken`):
  `node_modules/@clerk/nextjs/dist/types/index.d.ts:16`, and `require('@clerk/nextjs').getToken` is
  a `function`. A `/code-review low` pass claimed otherwise and was wrong — do not re-litigate from
  memory.
- Every 401 the browser can receive from `app/api/**` is a PRE-side-effect auth guard (`proxy.ts:19`
  plus `if (!userId) return 401` at the top of each handler, 40+ sites swept) — which is what makes
  replaying a failed POST safe.
- Baseline on this branch merged with `main` (`32791a9`): `npm test` 33 files / 461 tests passed,
  `npx tsc --noEmit` clean — both run 2026-08-12 on the merge commit.

## Done
- #734 BUILD — RESULT: all seven specs converted to `gotoProtected`/`signInAndGoto`, plus
  `waitForServerSession` / `signInAndWaitForSession` in `e2e/auth-helpers.ts`. tsc + eslint clean,
  `npx playwright test --list --project=authenticated` lists 35 tests in 9 files, `/code-review low`
  clean. PR #738, 11/11 green on `73d4412` over two consecutive `Authenticated E2E` runs.
- MERGED: #727 as PR #736 (`01a00ee`), #733 as PR #737 (`32791a9`), #726 as PR #735 (`ff55ad2`),
  #718 as `4ac7228` (its prod migration is applied — see Facts). #715 (#731), #714, #713, #710,
  #709, #708, #722 merged earlier.

## Open items
- Still open from #715: five call sites silently skip on a null `contact_email`
  (`lib/abo/verifyAbo.ts:226`, both spouse-link routes,
  `app/api/admin/members/verify/[id]/route.ts:99`, `lib/server/member-registration.ts`) — a shared
  `resolveProfileEmail()` would fix all six.
- NOTED (same-class as #715): `lib/email/send.ts:129` still reads `if (!config.enabled)`, the check
  #715 tightened to `!== true`. `enabled` comes from JSONB through an `as EmailConfig` cast, so a row
  holding `"true"` or `1` makes the master kill switch fail OPEN. Repo-wide sweep: exactly one
  instance left. One-line fix, needs its own ticket.
- NOTED (from #726 GCR): `scripts/check-env.js` has no regression tests — it runs side effects at
  require time including `process.exit`, so testing it needs the resolver extracted into a module.
- NOTED (same-class, from #710): the case-sensitive email match fixed in the #710 RPC also exists in
  TypeScript at `lib/server/member-registration.ts` — `.eq('email', contactEmail)` in `attendEvent`'s
  D9 adopt step. `Ivan@Example.com` is not adopted and gets a second row. Needs `citext`/`lower()`
  or `.ilike()`.
- NOTED: `app/api/calendar/feed-token/route.ts:21,45,81` and
  `app/api/profile/spouse-link/route.ts:138` still `await getBaseUrl()` unguarded. Neither commits
  irreversible state first, so neither has #713's half-success shape. No ticket filed.
- NOTED: `e2e/server-watchdog-reporter.ts:57` calls `process.exit(1)`, skipping Playwright's
  `test.afterAll` — if the dev server dies during `event-registrations-auth.spec.ts`, its cleanup
  never runs and seeded rows are orphaned in the shared DEV project.
- NOTED: `types/supabase.ts:2370` types five `get_event_registrations_for_viewer` returns as
  non-nullable `string` while all five are NULL in normal operation.
- NOTED: a signed-in member blocked by a FULL event still gets `ResendLinkForm` (the guest
  magic-link resend) at `app/events/[eventId]/register/page.tsx:179` and `:216` — wrong flow for a
  portal identity.
- NOTED: `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`) still has the
  detached-anchor + synchronous-`revokeObjectURL` pattern fixed in `AddToCalendarMenu.tsx`.
- NOTED: `docs/ai/REF.md` §6 Edge Functions table lists `send-event-reminders` (does not exist) and
  omits `deliver-email-notifications`; §5's `guest_registrations` row is the pre-#705 column list.
- FLAKE (not a spec defect): `Authenticated E2E (Clerk)` can fail wholesale at `clerk.signIn()` with
  `[Clerk Testing] FAPI request failed after 4 attempts` — Clerk's dev FAPI transiently down. Re-run
  the same commit; do not "fix" it in the specs.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all four
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
