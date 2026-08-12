## Goal
PLAN + CLAIM + BUILD issue #726 (`2608-DEV-726`) on branch `dev/2608-DEV-726` — a member who opens
the calendar popup's **Registrations** tab loses the Attend button, the share/QR buttons and the
event meta, with nothing on screen explaining why. A regression from #721, which gave plain members
the tab bar that makes the state reachable.

## Now
PLAN, CLAIM and BUILD are complete. **PR #735 is open as a DRAFT**, `MERGEABLE`, with all 11
checks green on `17bc5a7` — including `Authenticated E2E (Clerk)` in 6m5s (a real run, not the
old vacuous skip) and `390px smoke vs preview` in 2m32s; Vercel reports "Deployment has
completed". Branch pushed 2026-08-12 under an explicit grant.
GCR run against PR #735 (2026-08-12): CodeRabbit posted 3 inline comments even though its CHECK
reported "Review skipped: draft pull request" — never trust the check status, always fetch
`pulls/N/comments`. 2 applied in full, 1 applied in part:
- `EventPopupShell.tsx:78` explicit comparisons in `showActions` (Major) — APPLIED. Dropped
  CodeRabbit's `event !== null`: the prop type is `EventDetail | undefined` and the value comes
  from `useQuery`, whose `data` is never null.
- `member-attend-auth.spec.ts` `clearMemberRegistration` now throws on the delete error (Minor) —
  APPLIED, matching `seedMemberRegistration`.
- `check-env.js` empty-value contract (Major) — APPLIED the resolver half: DEFINED wins at each
  level, empty included, mirroring `@next/env` and `scripts/*`'s `loadEnvFile` (both assign only
  when `=== undefined`). SKIPPED the "add regression cases" half: no `scripts/*.test.js` harness
  exists and `check-env.js` runs side effects at require time incl. `process.exit`, so testing it
  needs the resolver extracted into a module — a refactor, not a review fix. Needs its own ticket.
Remaining before merge: the human 390px eyeball on BOTH tabs (the "no visual change on the Roles
tab" claim is the one item no check covers), then mark ready -> one CodeRabbit pass (it skipped
while the PR is a draft) -> fix findings in ONE batched push.
- Issue #726 body now carries the PLAN, a file-path-level DoD, Affected Files, Gotchas, Migration &
  Test Impact, `## Design Checklist` (4/4) and `## Branch dev/2608-DEV-726`.
- `2d301e9` — claim row in `docs/CLAIMS.md` (migration: no). `caf0fc0` — the fix.
- The fix: `EventPopupShell.tsx`'s outer branch became `event ? … : null`; `showMeta` now gates only
  the date/time/`meeting_url`/`attendForLink` meta and the description. A new local
  `showActions = !!event && event.allow_guest_registration && !isGuest` gates the action row, which
  renders on BOTH tabs inside the SAME `px-4 py-3 border-b` container as the meta — so the Roles tab
  is pixel-identical (a sibling block would have added a second divider). `!isAdmin` still gates
  `AttendSection` alone. Spacing preserved: the group carries `space-y-3`, plus `mt-3` only when the
  meta above it is shown.
- `e2e/member-attend-auth.spec.ts` gained a 390px `@auth` test asserting Attend + Share stay visible
  after clicking the Registrations tab, that the `attendForLink` hint is correctly GONE (proving the
  gate was split, not deleted), and no 390px horizontal overflow. A `clearMemberRegistration()`
  helper was extracted from `seedMemberRegistration()`, which now calls it.
Verified: `npx tsc --noEmit` -> **clean, zero errors** (the long-standing stale
`.next/dev/types/validator.ts:566` error is gone — `.next` has since been regenerated);
`npx eslint` on the three changed files -> **0 errors / 1 warning**, identical to the baseline taken
before the edits (`EventPopup.tsx:61` unused `request_id`, pre-existing).
No unit test can cover this: `vitest.config.ts` includes only `lib|app/**/*.test.ts` +
`scripts/**/*.test.js` under `environment: 'node'`, and the repo has no `*.test.tsx` at all.
Component verification is e2e-only.
Verified 2026-08-12, run LOCALLY against hosted DEV (`iymwxdewcpvpjgzewtzk`), not just CI:
`npx playwright test --project=authenticated e2e/member-attend-auth.spec.ts` -> **5 passed (34.6s)**.
The regression test was proven RED first — reverting only `EventPopupShell.tsx` to `2d301e9` and
re-running it fails on `getByRole('dialog').getByRole('button', { name: /^attend$/i })`,
"element(s) not found", which is the reported symptom exactly; restored from a byte-identical copy
(`git status` clean afterwards) and re-run -> **1 passed**.
`/code-review low` on the branch diff -> **zero findings**.

## Next
1. ~~`/code-review low` on the branch diff~~ — DONE, zero findings.
2. ~~push + open the draft PR~~ — DONE, PR #735.
3. ~~CI green + Vercel preview READY~~ — DONE, 11/11 on `17bc5a7`. Still to do: eyeball the
   preview at 390px on both tabs — the DoD's "no visual change on the Roles tab" claim is the one
   item no automated check covers, and it needs a signed-in member so it cannot be automated here.
4. Mark ready -> one CodeRabbit pass -> fix findings in ONE batched push.
5. Merge -> GCR: prune the `#726` claim row (fold into this PR's own commits, per Constraints),
   close #726. **No migration**, so no prod gate for this ticket.
6. **STILL OPEN FROM #718:** PR #732 merged as `4ac7228` and it SHIPPED A MIGRATION, so the gated
   `migrate-prod` run is armed and unapproved. Prod ledger head must move
   `20260811000000` -> `20260811000100`, then smoke `https://www.teamenjoyvd.com`. Until that runs,
   prod has the app code that raises `P0718` but NOT the trigger that produces it — harmless (the
   app-level check still guards) but the race is only closed on DEV.
7. Follow-ups filed and unclaimed: **#727** (401 eviction during Clerk token refresh, `priority:high`),
   **#733** (machine-readable capacity failure code), **#734** (seven e2e specs with the sign-in race).

## Constraints
- Never push without an explicit grant in this conversation. Grants from earlier tickets/sessions do
  not carry over.
- Never apply migrations to a hosted Supabase project (DEV or prod) without asking first.
- Fold `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR, never a
  standalone cleanup PR.
- `.env.local` holds PRODUCTION Supabase credentials; `.env.development.local` holds the DEV stack.
  Run `npm run check:env` before any command touching a hosted DB.

## Decisions
- DECISION (#726, from PLAN): take the issue's **first** suggested fix (un-scope the actions), not
  the "compact footer on the Registrations tab" variant — the footer duplicates the action row's
  render conditions in two places and drifts the moment either changes.
- DECISION (#726, from PLAN): depart from the suggestion's *structure*. The actions stay inside the
  existing bordered container and it is the META CONTENT that becomes conditional, rather than
  lifting the actions into a sibling block. A sibling block adds a second `border-b` hairline to the
  Roles tab, which has no bug. The container is skipped entirely when neither half has anything to
  render, so an event with `allow_guest_registration = false` shows no empty 24px strip.
- DECISION (#726, from PLAN): the `cal.attendForLink` hint STAYS tab-scoped with the meta, even
  though the issue lists it among the things that disappear. It exists solely to explain an absent
  `meeting_url` (`EventPopupShell.tsx` D3 comment), and `meeting_url` is meta.
- DECISION (#726): `showMeta` keeps its name — the change makes the name accurate for the first
  time. One consumer, one prop, unchanged signature, so no REFERENCE SWEEP is triggered.

## Facts
- `EventPopupShell` has exactly ONE consumer (`EventPopup.tsx:9`); `AttendSection` has exactly one
  (`EventPopupShell.tsx:18`). There is no shared "popup action row" helper.
- `EventActionsTabs.tsx:52-56` sets an explicit `role="tab"`, which OVERRIDES `<button>`'s implicit
  role — `getByRole('button')` matches nothing there. Same trap as ATTEMPT 1 below.
- `playwright.config.ts` never sets `fullyParallel`, so Playwright 1.61 parallelizes by FILE: tests
  inside one spec run in declaration order in one worker, and DB state carries between them.
- Authenticated e2e cannot run against `.env.local` — it holds PROD credentials. Use the DEV
  override (`iymwxdewcpvpjgzewtzk`) documented in the no-local-Docker memory.
- Production smoke 2026-08-11: `https://www.teamenjoyvd.com` 200, `/sign-in` 200.

## Done
- Two findings from the #726 verification pass, FIXED on this branch at the user's explicit
  instruction (they are not #726 defects — flagged as scope-mixing when asked):
  1. `e2e/member-attend-auth.spec.ts` `openEventPopup` now waits for the dialog to contain the real
     event title, not merely to be visible. The dialog turns visible while `EventPopupShell` still
     renders its `…` loading placeholders, so on a cold dev server a caller's 5s default expect
     timeout could land on the loading state (observed: snapshot `dialog: text: …`). Uses the same
     15s budget as the existing `eventButton` wait. NOT re-reproduced cold — a restart keeps
     Turbopack's persistent cache — so the fix is targeted at the observed state, not a repro.
  2. `scripts/check-env.js` `resolveValue` now resolves `process.env` BEFORE the two env files,
     matching `@next/env` (which only fills a key absent from the initial `process.env` snapshot)
     and `playwright.config.ts:10-20`. Empty is unset at every level; the file pair keeps Next's
     relative order. Verified both branches: no exports -> `LOCAL stack (127.0.0.1)`; with the DEV
     vars exported -> `DEV project (iymwxdewcpvpjgzewtzk) — safe for local writes`.
- #726 PLAN + CLAIM — RESULT: verdict READY; issue body carries the DoD, affected files, gotchas and
  the structural correction to the issue's own suggestion; Design Checklist 4/4;
  `## Branch dev/2608-DEV-726`; claim row committed at `2d301e9` against an EMPTY claims table (no
  overlap: zero in-flight rows, zero open PRs at claim time).
- #726 BUILD (code complete, `caf0fc0`) — RESULT: 3 files, +117/-100 (most of it reindentation).
  Verified as recorded under `## Now`: tsc clean, eslint at baseline, `/code-review low` zero
  findings, and the authenticated e2e spec 5/5 green locally against DEV with the new test proven
  red-then-green. Remaining gate is the PR itself (Vercel preview READY + CI green), which needs a
  push grant — see `## Next` item 2.
- #718 MERGED — RESULT: PR #732 -> `4ac7228`. `guest_capacity` is now DB-enforced by
  `trg_enforce_event_guest_capacity` (SQLSTATE `P0718`) on DEV; the race was proven closed there
  with two pg_cron workers on the same tick (B took the advisory lock and committed, A blocked
  ~79ms, re-counted and raised). **Prod migration gate still unapproved — see `## Next` item 6.**
- #715 merged (PR #731, `ddaa2e5`). #714 merged (`c6ba2f2`). #713 merged (`2f82d80`).
  #710 fully DONE incl. prod, ledger head `20260811000000`. #709 (PR #721), #708 (PR #720),
  #722 (PR #724) merged.

## Open items
- Still open from #715: five call sites silently skip on a null `contact_email`
  (`lib/abo/verifyAbo.ts:226`, both spouse-link routes,
  `app/api/admin/members/verify/[id]/route.ts:99`, `lib/server/member-registration.ts`) — a shared
  `resolveProfileEmail()` would fix all six.
- NOTED (not done, same-class as #715): `lib/email/send.ts:129` still reads `if (!config.enabled)`,
  the exact check #715 tightened to `!== true`. `enabled` comes from JSONB through an
  `as EmailConfig` cast, so a row holding `"true"` or `1` makes the master kill switch fail OPEN.
  Repo-wide sweep: exactly one remaining instance. One-line fix, needs its own ticket.
- NOTED (not done, out of #713's scope): `app/api/calendar/feed-token/route.ts:21,45,81` and
  `app/api/profile/spouse-link/route.ts:138` still `await getBaseUrl()` unguarded. Neither commits
  irreversible state first, so neither has the #713 half-success shape. No ticket filed.
- NOTED (same-class, found on #710): the case-sensitive email match fixed in the #710 RPC also
  exists in TypeScript at `lib/server/member-registration.ts:239` — `.eq('email', contactEmail)` in
  `attendEvent`'s D9 adopt step. `Ivan@Example.com` is not adopted and gets a second row. Needs a
  citext/lower() index or `.ilike()` — its own ticket.
- NOTED (merged in #724): `e2e/server-watchdog-reporter.ts:57` calls `process.exit(1)`, skipping
  Playwright's `test.afterAll`. If the dev server dies during `event-registrations-auth.spec.ts`,
  its cleanup (`:164-171`) never runs and seeded rows are orphaned in the shared DEV project.
- NOTED (merged in #721): `types/supabase.ts:2370` types five
  `get_event_registrations_for_viewer` returns (`email`, `profile_id`, `sharer_name`,
  `attended_at`, `cancelled_at`) as non-nullable `string`, but all five are NULL in normal
  operation. The current caller casts correctly; the next one that trusts the generated type
  dereferences a null with no compiler warning.
- NOTED (found during #708): a signed-in member blocked by a FULL event still gets `ResendLinkForm`
  — the guest magic-link resend — at `app/events/[eventId]/register/page.tsx:179` and `:216`.
  Wrong flow for a portal identity; pre-existing blocked branch.
- NOTED: `app/events/[eventId]/join/components/JoinActions.tsx:30-39` (`downloadIcs`) still has the
  detached-anchor + synchronous-`revokeObjectURL` pattern fixed in `AddToCalendarMenu.tsx` — same
  latent no-file-downloaded bug in Firefox/Safari. Needs its own ticket.
- NOTED: `docs/ai/REF.md` §6 Edge Functions table still lists `send-event-reminders` (does not
  exist) and omits `deliver-email-notifications`; §5's `guest_registrations` row is still the
  pre-#705 column list.
- FLAKE (not a spec defect): `Authenticated E2E (Clerk)` can fail wholesale at `clerk.signIn()` with
  `[Clerk Testing] FAPI request failed after 4 attempts` against `loved-mole-75.clerk.accounts.dev`
  — no assertion ever runs and the job takes ~3x baseline. Clerk's dev FAPI being transiently down.
  Re-run the same commit; do not "fix" it in the specs.
- CodeRabbit's "run member-share-register-auth serially" finding (#720) was DISPROVED, not deferred
  — see the `fullyParallel` fact above. Do not "fix" this later.
- CodeRabbit's "localize the member capacity error" was DECLINED TWICE (#720, #732): the client
  selects copy by matching ENGLISH server text (`MemberAttendPanel.tsx:73-78`,
  `EventPopup.tsx:76-78`, both `raw.includes('capacity')`), so returning Bulgarian makes BOTH
  matchers miss. The real fix is #733's machine-readable `code`.

## Facts (added 2026-08-12, GCR #735)
- Killing a background task wrapper does NOT necessarily kill `next dev` — the node process can
  survive holding the port, and losing its stdout pipe makes every write throw
  `write EPIPE` as an uncaughtException, which kills Next's render WORKERS. The server then still
  answers `/` from cache (a naive curl health check says 200) while every route needing a worker
  500s with "Jest worker encountered 2 child process exceptions". Start it with stdout redirected
  to a log file, and health-check a real route, not `/`.
- Local authenticated e2e is NOT trustworthy on a cold server: a full run right after start gave
  3 failures that all passed once warm. Only a warm-server run is evidence. A/B against a stash
  proved this: stashed passed, restored ALSO passed, so the first A/B reading was itself noise.

## Failed attempts
- ATTEMPT 1 [L1] (#709 GCR): adding an explicit `role="tab"` to the tab-bar buttons broke all 4
  `event-registrations-auth` specs — an explicit ARIA role OVERRIDES `<button>`'s implicit role, so
  `getByRole('button', …)` matched nothing. Lesson: adding an ARIA role is a REFERENCE SWEEP trigger
  for `getByRole` locators, not just for symbol renames.
