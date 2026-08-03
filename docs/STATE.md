## Goal
BUILD issue #688 (2608-DEV-688, branch `dev/2608-DEV-688`): keep on-behalf payment attribution
visible AFTER admin approval, collapse an approved on-behalf group to the one bank transfer it
was, add a `/profile/payments` drill-down ledger (status filter, debounced search, date range,
lifetime totals, CSV export), and fix the trip-payment "always EUR" mislabel on the way.

## Now
BUILD steps 1-3 are CODE-COMPLETE and statically verified; step 4's spec is WRITTEN but has
never been EXECUTED. All 9 files in the DoD are edited. Nothing is committed yet.
BLOCKED on one decision only: the authenticated E2E cannot run in this session — Docker
Desktop is down, so local Supabase (`127.0.0.1:54321`, which `.env.development.local`
selects) is unavailable, and DEV credentials are not in any local env file. See `## Open
items` for the three ways forward.

## Next
1. Decide how to execute `npx playwright test --project=authenticated` (see `## Open items`),
   then run it and record the result. L8 is the ONLY matrix item with no evidence yet.
2. /code-review low.
3. Commit, then ASK before pushing (the 2026-08-03 push grant was scoped to the CLAIM push).
4. DRAFT PR -> CI green + Vercel preview READY -> mark ready -> one CodeRabbit pass -> merge
   -> GCR (drop the CLAIMS.md row IN the merging PR, close #688).

## Constraints
- Never push to `main`; `dev/2608-DEV-688` only.
- No `git push` unless the user asks for a push in this conversation (quote required).
  GRANTED 2026-08-03, verbatim: "push to github so I can start tomorrow ready to go with BUILD".
  Scope: push `dev/2608-DEV-688`. Does NOT cover opening a PR or merging — ask again for both.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- Issue-stated out of scope, must NOT be fixed here and must NOT be propagated into the new page
  or the CSV export: `shared.tsx:131-133` renders `proof_url` as an `href` although it is a
  private-bucket storage KEY, not a URL (`lib/payments/proof.ts:1-10`).
- Issue-stated: NO new API route, NO schema change, NO TanStack Table, and `abo_number` is
  deliberately NOT added to the embeds (it is null for exactly the people it would identify).
- Issue-stated: ONE responsive layout file for the ledger table. 6 columns permits a dual layout
  under the Layout Decision Rules but does not require one; two files would duplicate ~40 lines.

## Decisions
- DECISION (PLAN 2026-08-03): #677 landed FIRST (`5311a9c`), so #688 is the second lander and owns
  the guest extension. The NAMING half already ships — `payment_guests(id, name)` is in the
  `/api/payments` select, `beneficiary_guest_id`/`payment_guests` are on `GenericPayment`, and
  `beneficiaryLabel()` in `lib/payments/labels.ts` already prefers the guest name. What #688 adds
  is the TOTALS half.
- DECISION: totals reduce over RAW rows, not over collapsed entries — reducing over entries
  double-counts the payer's own share. Lifetime, unaffected by the filters, labelled as such.
- DECISION: `VARIABLE_CAP` now caps collapsed ENTRIES, not raw rows. The bento's unit is "latest
  transactions" and a group IS one transaction.
- DECISION: the new client component lives at
  `app/(dashboard)/profile/payments/PaymentsLedgerClient.tsx`, matching
  `profile/spouse-link/SpouseLinkClient.tsx` — not under `profile/components/`.
- DECISION: the page reuses query key `['profile-generic-payments']`, so client-side navigation
  from the bento mounts it warm off the existing cache. No second route, no refetch per keystroke.
- DECISION: `payment.allPayments` is reused as the new page's title, so removing the "show more"
  Drawer orphans no translation key.

## Facts
- Branch `dev/2608-DEV-688`, cut from `origin/main` @ `5311a9c`, upstream
  `origin/dev/2608-DEV-688`. `git checkout -b X origin/main` sets the upstream to `origin/main` —
  a bare `git push` would then target main; this branch was corrected with
  `git branch --unset-upstream` before its first push.
- BUILD BASELINE, captured 2026-08-03 before any edit:
  `npx vitest run lib/payments` -> `Test Files 4 passed (4)`, `Tests 58 passed (58)`.
- WIDER baseline is RED and NOT caused by any current work:
  `lib/actions/guest-registration.test.ts` fails 2-3 of its 24 tests non-deterministically (spy
  pollution surfacing under this machine's slowness). Run
  `npx vitest run --exclude lib/actions/guest-registration.test.ts` and compare against that, never
  against green.
- Key symbols: `payerOf` -> `lib/payments/proof.ts:43`; `guestLabel`/`beneficiaryLabel` ->
  `lib/payments/labels.ts`; `personalApprovedTotal` -> `lib/payments/totals.ts:30`;
  CSV quoting prior art -> `lib/csv-export.ts:70-99` + `app/admin/members/components/MembersTable.tsx:88-93`;
  300 ms search debounce prior art -> `app/admin/calendar/components/AdminCalendarClient.tsx:54-69`;
  `GenericPayment` -> `app/(dashboard)/profile/types.ts:113-152`.
- `e2e/payments-on-behalf.spec.ts` is already in the `authenticated` `testMatch` and BOTH
  `testIgnore` regexes (`playwright.config.ts:64,78,85`). A new spec file would cost three regex
  edits for nothing.
- A guest payment row satisfies `profile_id = paid_by_profile_id` (`payments_guest_ledger_check`,
  `20260801000000_2607_feat_677_pay_guests.sql:120`), so it LOOKS like the payer's own row. The
  "paid" bucket must exclude `beneficiary_guest_id != null`; those rows belong in "paid on behalf
  of others". This is the highest-risk item in the ticket.
- DEV Supabase project ref `iymwxdewcpvpjgzewtzk`. Apply migrations with `supabase db push`;
  ad-hoc SQL with `supabase db query --linked -f <file>`. #688 needs NO migration.
- If `npm run build` dies with `Fatal process out of memory: Zone` or times out on a warm `.next`,
  first response is `rm -rf .next` — the OS, not the V8 heap, is the limit. Do NOT raise
  `--max-old-space-size`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash followed by hex-digit characters parses as a
  CSS unicode escape and kills `npm run build` with `Invalid code point <n>` pointed at
  `app/globals.css:1:1` — nowhere near the real file. Describe the path, never paste it.
- Regenerate `types/supabase.ts` through Git Bash (`>` redirect), NOT PowerShell
  `Out-File -Encoding utf8` — the latter writes CRLF + BOM and rewrites all ~3100 lines.

## Done
- PLAN #688 (2026-08-03) — RESULT: READY. Premise re-verified on `main` @ `5311a9c`: `types.ts`
  declares no `currency` while `app/api/payments/route.ts:29` selects it, and both `shared.tsx:114`
  and `PaymentsSection.tsx:44` fall back to `payable_items?.currency ?? 'EUR'` — and a trip
  payment's `payable_items` is NULL, so every trip payment is force-labelled EUR.
  `PaymentsSection.tsx:35` filters `admin_status !== 'pending'`, which is where attribution is
  lost at approval. Issue line refs were 1-3 lines stale (written pre-#677-merge); every code
  claim holds. 9 files, ~600 lines estimated, migration: no, E2E project: `authenticated`.
- BUILD #688 steps 1-3 (2026-08-03) — RESULT: code-complete, statically green.
  `npx vitest run lib/payments` -> 5 files / 88 tests passed (baseline was 4 / 58; +30 in the
  new `lib/payments/ledger.test.ts`). `npx vitest run --exclude lib/actions/guest-registration.test.ts`
  -> 23 files / 311 tests passed. `npm run check-types` -> clean. `npm run lint` -> 0 errors
  (476 warnings, all pre-existing; the two new files contribute none). `npm run build` -> success,
  `ƒ /profile/payments` present in the route table.
  Matrix status: L1, L2, L4, L5, L6, L7 asserted in unit tests; L3 asserted at the helper level
  (`payerName`) plus an E2E spec that has not run; L8 has NO evidence — it needs a real 390px
  render behind Clerk auth.
  Design notes worth keeping: filtering on the new page happens at ENTRY level, never row level
  (row-level filtering would render a 3-person group with a partial total); `lifetimeTotals`
  counts `admin_status === 'approved'` only, matching `personalApprovedTotal`, and
  `payment.lifetimeNote` says so in both languages; `PaymentRow` now takes
  `{ entry, me, cancelledTripIds }` instead of `{ pay, cancelledTripIds }`.
- CLAIM #688 (2026-08-03) — RESULT: complete and pushed. `docs/CLAIMS.md` registry was EMPTY, so no
  scope overlap and no in-flight `migration: yes` row to sequence against. Issue #688 updated with
  DoD + affected files + gotchas + `## Design Checklist` (4/4) + `## Branch`; row committed at
  `716b4ad`; branch pushed (`* [new branch] dev/2608-DEV-688 -> dev/2608-DEV-688`).

## Open items
- BLOCKING #688's Done gate: the `authenticated` Playwright project has never executed the new
  L3/L8 specs. `playwright.config.ts:10-20` loads `.env.development.local` FIRST and never
  overwrites, and that file sets `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` — so a local
  run targets LOCAL Supabase, not `.env.local`'s prod project. Local Supabase is down because
  Docker Desktop is not running. Three ways forward: (a) start Docker Desktop, `npx supabase
  start`, `npm run e2e:seed-clerk`, then `npx playwright test --project=authenticated`;
  (b) point the run at DEV (`iymwxdewcpvpjgzewtzk`) by pulling the Pre-Production env vars —
  do NOT let that overwrite `.env.local`, which holds prod credentials; (c) accept the Vercel
  PR preview as the 390px check and run the specs after merge. (a) is the honest one.
- NOTED (not done): `app/(dashboard)/profile/components/PaymentsSection.tsx:30`
  `pendingGroupsIPaidFor` still filters `paid_by_profile_id !== myProfileId` directly rather
  than through `payerOf`, so a legacy pending group with a NULL `paid_by_profile_id` is not
  offered a withdraw card. Pre-existing, untouched by #688.
- CARRIED FROM #677, NOT DONE — the prod tail. PR #689 is merged (`5311a9c` on `main`) but the
  post-merge sequence was never executed: approve the gated `migrate-prod` run (GitHub Actions,
  `production` environment, manual approval — #677 HAS a migration), confirm it applied,
  smoke-check `https://www.teamenjoyvd.com`, then close issue #677. Do this BEFORE #688 reaches
  prod, or #688 ships against a schema its migration never landed on.
- CARRIED FROM #677, NEVER VERIFIED (G4): admin guest link/unlink has NO automated coverage and has
  never been exercised against a real database. `e2e/payments-guest.spec.ts` covers the member side
  only. Do it by hand: `/admin/payments` -> Guest links -> pick a member -> Link -> Unlink.
- CARRIED FROM #677: DEV fixtures still present and still uncleaned — `seed_676_*` (7 profiles,
  ABOs 6760001-6760004, deferred by the user 2026-07-31) and a `payment_guests` row named
  `E2E Guest Nadia` written by `e2e/payments-guest.spec.ts` (uniquely indexed, so re-runs reuse it
  rather than accumulate). Both are still NEEDED for the authenticated E2E — do not delete before
  #688's step 4 runs.
- CARRIED FROM #676, UNMEASURED: does PROD have `payments` rows? If yes, `/profile` was crashing in
  production for every such user between 2026-07-27 (`570d587`, #670) and the #676 merge. One
  read-only query answers it: `select count(*), count(distinct profile_id) from payments`.
- NOTED (not done), in scope of the FILES #688 touches but explicitly excluded by the issue:
  `shared.tsx:103` gates the cancelled-trip info marker on `payable_items?.item_type === 'trip'`,
  which is always false for a real trip payment (its `payable_items` is NULL).
- NOTED (not done): `app/admin/payments/components/LogPaymentDrawer.tsx:60` merges
  `membersData.manual_members_no_abo`, but `GET /api/admin/members` never emits that key — the
  admin log-payment dropdown silently excludes ABO-less profiles.
- NOTED (not done): `app/(dashboard)/profile/types.ts:80` declares a SECOND `TripPayment` type,
  unrelated to the one in `app/(dashboard)/trips/[id]/page.tsx`. Name collision, left alone.
- REFERENCE SWEEP owed at BUILD step 2, per CLAUDE.md iron rule 3: `groupByItem` (single caller)
  and the removed `listDrawerOpen` Drawer. `ShowMoreButton` keeps its other three callers
  (`TripsSection.tsx:61`, `VitalsSection.tsx:96`, `ParticipationSection.tsx:70`) — do not delete it.
- The CI check `Authenticated E2E (Clerk)` has historically gone green in seconds WITHOUT running
  the specs (tracked as #679). It ran for real on #677's PR, but do not treat a green tick as
  proof: confirm the run reports 0 skipped, and run step 4 locally against DEV regardless.

## Failed attempts
(none for #688 — no code written yet)
