## Goal
BUILD issue #677 (2607-DEV-677, branch `dev/2607-DEV-677`): payments on behalf of others — ad-hoc
guests with NO account. A `payment_guests` row remembers the person; their `payments` row keeps
`profile_id = the payer` (a guest has no ledger) but must be EXCLUDED from the payer's own trip
total; an admin can later link a guest to a real member as a record only.

## Now
Draft PR #689, ALL 11 CHECKS GREEN at `4c921ef` — including `Build` (59s), which settles the build
that never completed locally (that ceiling was this machine, not the code), and
`Authenticated E2E (Clerk)`, where `e2e/payments-guest.spec.ts` PASSED in 16.0s on its first
successful execution (`✓ 12 [authenticated] … 19 passed`).

Two things still have no evidence and both need the preview by hand: admin link/unlink (G4), and a
390px look at the new surfaces. Then mark ready for CodeRabbit.

VERIFIED on the current tree (2026-08-02): `npx tsc --noEmit` exit 0; `npx eslint` on every changed
area exit 0, 0 problems; `npx vitest run --exclude lib/actions/guest-registration.test.ts` =
`Test Files 21 passed (21)`, `Tests 268 passed (268)`; the excluded file alone = `3 failed | 21
passed (24)`, byte-identical to the red baseline and untouched by this branch. The arithmetic ties
out: 280 baseline - 24 excluded + 6 new `totals.test.ts` + 6 new guest route cases = 268.

NOTE on running the build here: `npm run build` timed out at 10 minutes on a warm `.next`. Per the
carried note, `rm -rf .next` first — the OS, not the V8 heap, is the limit. Do NOT raise
`--max-old-space-size`.

## Next
1. G4 (admin link/unlink) still has NO evidence of any kind — no test, never run against a database.
   Do it on the preview: `/admin/payments` → Guest links → pick a member → Link → Unlink.
2. Manual 390px pass on the preview: add a guest from the picker, submit, confirm the payer's trip
   progress bar counts only their own share (G3 in the real UI), confirm the `/profile` group card
   names the GUEST and not the payer, admin link + unlink.
3. Mark ready → one CodeRabbit pass → fix in ONE batched push → merge.
4. After merge: approve the gated `migrate-prod` run (this PR HAS a migration), smoke-check
   production, then GCR — remove the `docs/CLAIMS.md` row, close #677.

## Constraints
- Never push to `main`; `dev/2607-DEV-677` only.
- No `git push` unless the user asks for a push in this conversation (quote required). GRANTED
  2026-08-02, verbatim: "Address all security and non-security items discovered and open a draft PR".
  Scope: push `dev/2607-DEV-677` and open a DRAFT PR. Nothing else.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row + `docs/STATE.md` updates into this PR — no standalone cleanup PR.
- Change only what the DoD requires; log other findings as NOTED.
- Ask before editing `docs/guardrails/PROJECT.md`.
- Issue-stated non-goal: linking a guest to a member is a RECORD ONLY — it moves no money and
  rewrites no `payments` row. Do not invent a migration of payment rows.
- Issue-stated: `get_payable_beneficiaries` is deliberately NOT touched — guests merge in TypeScript
  so the RPC's LOS semantics stay pure.

## Decisions
- DECISION (from PLAN, settled with the user 2026-08-01): the accounting correction lives in the
  REDUCERS, not the query — `page.tsx` keeps fetching the guest row so the payer still sees money
  they really paid; only `approvedTotal` skips it.
- DECISION: ad-hoc people carry `kind: 'guest'` + `relation: 'external'` (new `payment.relExternal`
  label). `relation: 'guest'` is already taken by #676 for ABO-less approved MEMBERS
  (`20260731000000_2607_feat_676_pay_on_behalf.sql:173`); nothing shipped by #676 is renamed.
- DECISION: `GuestLinkPanel` reuses the `['admin-members']` react-query key + a hoisted dedupe
  helper. `allMembers` is NOT a reusable array — it is computed inside `LogPaymentDrawer.tsx:50-67`
  with `enabled: open`.
- DECISION: migration filename `20260801000000_...` — 2026-08-01 is a new day (latest existing is
  `20260731000000`), so the counter resets to `000000` per GOTCHAS row 14.

## Facts
- DEV Supabase project ref `iymwxdewcpvpjgzewtzk`; `supabase/.temp/project-ref` confirms the CLI is
  linked to DEV. Apply with `supabase db push`; ad-hoc SQL with `supabase db query --linked -f <file>`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash followed by hex-digit characters parses as a
  CSS unicode escape, and `String.fromCodePoint` on the result exceeds the Unicode maximum and kills
  `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1` — nowhere near the
  real file. Describe the path, never paste it; writing the sequence out even as an example
  re-breaks the build.
- If `npm run build` dies with `Fatal process out of memory: Zone`, first response is `rm -rf .next`
  — the OS, not the V8 heap, was the limit; do not raise `--max-old-space-size`.
- Premise anchors verified on `main` @ `dd91007`: `app/(dashboard)/trips/[id]/page.tsx:84-87` is the
  ONLY payments query feeding a money total; `AttendeeView.tsx:118-120` and `ArchivedView.tsx:17-19`
  both reduce that same prop into `approvedTotal`.
- `payments` already has THREE FKs to `profiles` (`profile_id`, `logged_by_admin`,
  `paid_by_profile_id`) — every PostgREST embed must be hinted. `payment_guests` will add a table
  with TWO FKs to `profiles` (`owner_profile_id`, `linked_profile_id`), same class of trap.
- `MAX_TOTAL_CENTS` = 100000000 is asserted in three places that must stay in step:
  `lib/payments/split.ts`, `app/api/payments/route.ts:110`, `submit_payment_group`.

## Done
- BASELINE (before any code edit, `npm run verify`) — RESULT: RED. `Test Files 1 failed | 20 passed
  (21)`, `Tests 3 failed | 277 passed (280)`, all in `lib/actions/guest-registration.test.ts`. NOT
  caused by #677 (only `docs/STATE.md` and the new migration existed at that point) and NOT stable:
  a second run of that file alone gave `2 failed | 22 passed (24)` with a DIFFERENT test hitting the
  5000ms timeout and the spy count differing (`upsertSpy` called 3 times, then 2, expected 1). Reads
  as cross-test spy pollution surfacing under this machine's slowness (68-128s transform/import).
  Compare every later run against this line, not against green.
- Step 1 DONE — `supabase/migrations/20260801000000_2607_feat_677_pay_guests.sql` applied to DEV via
  `supabase db push`. RESULT: 13/13 probes pass, DEV left at `payments_left=2 guests_left=0` (its
  pre-probe state). G1 `rows=2 guest_rows=1 guest_table=1 all_ledgers_on_payer=t`; G2 a re-typed
  guest (case + whitespace) reuses the row; G2b `guest_id` reuses it; G5 a guest row on a foreign
  ledger is rejected by `payments_guest_ledger_check`; G5b a guest row outside a group is rejected by
  `payments_group_pair_check`; G6 the same guest twice in one group rejected; G7 another payer using
  my guest rejected; G8 an entry naming two kinds rejected; G9 a blank guest name rejected; G10 the
  pure #676 payload still accepted; G11 paying for your upline still rejected; G12 the guest row
  survives `withdraw_payment_group`.
- BUG FOUND AND FIXED BY THE PROBES (G8): the "exactly one of profile_id / guest_id / guest" check
  computed `1 + 1 + (jsonb_typeof(e -> 'guest') = 'object')::int`, and `jsonb_typeof(NULL)` is NULL
  when the key is absent, so the sum was NULL and `NULL <> 1` filtered nothing. An entry naming BOTH
  a profile and a guest passed. Fixed with `coalesce(jsonb_typeof(...), '')`; re-applied to DEV via
  `supabase migration repair --status reverted 20260801000000` + `db push` (the migration is
  re-runnable throughout: IF NOT EXISTS / DROP+ADD / CREATE OR REPLACE).
- Step 2 DONE — `types/supabase.ts` regenerated from DEV (3044 -> 3110 lines), diff purely additive:
  the `payment_guests` table, `payments.beneficiary_guest_id` in Row/Insert/Update, and the FK
  relationships. `npx tsc --noEmit` exit 0. NOTE: regenerate through Git Bash (`>` redirect), NOT
  PowerShell `Out-File -Encoding utf8` — the latter writes CRLF + BOM and rewrites all 3100 lines.
- Steps 3-4 DONE — RESULT: `npx vitest run app/api/payments lib/payments` = `Test Files 5 passed (5)`,
  `Tests 79 passed (79)`; `npx tsc --noEmit` exit 0. Server: `eligibility.ts` gained `PayableGuest` /
  `fetchPayableGuests` / `guestIdentityKey` and `assertGroupAllowed` now takes `GroupEntry[]` (all
  three shapes) instead of a `string[]` of profile ids; `beneficiaries/route.ts` appends the caller's
  guests (never for a guest-ROLE caller); `payments/route.ts` rebuilds each entry key by key before
  it reaches the RPC. Accounting: the duplicated `approvedTotal` reducer was extracted to
  `lib/payments/totals.ts` (`personalApprovedTotal`) so G3 is testable directly — 6 cases in
  `lib/payments/totals.test.ts`, which is where the DoD's "route-level vitest case for G3" landed,
  since after the PLAN correction the arithmetic is in the reducers and not in any route.
- Steps 5-6 DONE (picker + admin), plus `e2e/payments-guest.spec.ts` and the REF/GOTCHAS updates.
  Picker: `components/payment/types.ts` now exports a DISCRIMINATED UNION (`kind: 'profile' |
  'guest'`) plus `rowKeyOf`/`displayNameOf`/`guestIdentity`; a guest rides `SplitRow.profileId` as an
  opaque prefixed row KEY (`guest:<uuid>` / `newguest:<n>`), so `lib/payments/split.ts` and its 27
  tests needed no change and a profile-only submission is byte-identical to #676's. Admin: the
  `allMembers` dedupe was hoisted to `app/admin/payments/components/members.ts` and is now shared by
  `LogPaymentDrawer` and the new `GuestLinkPanel` off one `['admin-members']` cache entry.
- BUG FOUND (invisible, would have broken the build tooling): `guestIdentityKey` in
  `lib/payments/eligibility.ts` was written with a literal NUL byte (U+0000) as its separator. Git
  classified the file as BINARY — `git diff` showed `Bin 3289 -> 9646 bytes` instead of a reviewable
  diff, which would have made the whole file unreviewable in the PR. Both copies (server
  `guestIdentityKey`, client `guestIdentity`) now use `JSON.stringify([name, email])`, which is also
  collision-free: any plain delimiter can appear inside a name a user typed. A NUL scan over every
  tracked .ts/.tsx/.sql/.md found no other instance.
- CLAIM complete: #677 has `## Design Checklist` (four checked) + `## Branch`; branch
  `dev/2607-DEV-677` checked out; `docs/CLAIMS.md` row registered at `a2e36ff`.
- SECURITY REVIEW done on the branch diff (BUILD EXECUTE gate; warranted by the new table, the new
  RLS policies and the replaced SECURITY DEFINER RPC). RESULT: no finding at confidence >= 8.
  Checked and cleared: the RPC keeps the GOTCHAS-34 guard and re-validates guest ownership inside
  the write transaction; `owner_profile_id` scopes every guest read; the "not yours" 403 is uniform
  and so is not an enumeration oracle; `payments_guest_ledger_check` makes a cross-ledger guest row
  unrepresentable; the #676 proof-URL disclosure class is unreachable because `payerOf()` resolves a
  guest row to the payer; no dynamic SQL; no `dangerouslySetInnerHTML`; Pattern A helpers only.
- CI, first run of PR #689: 10 of 11 checks green — `Build` (51s), `Type Check`, `Lint`, `Test`,
  `Security Audit`, `Replay migrations from scratch`, `Authenticated E2E (Clerk)` (5m8s, so it really
  ran; the vacuous-skip problem from #679 is gone), Vercel READY. `npm run build` therefore PASSES —
  the 10-minute failure was this machine, not the code, and that UNVERIFIED item is now closed.
- The guest name is now rendered through `lib/payments/labels.ts` (`guestLabel` /
  `beneficiaryLabel`), tested by 10 cases in `labels.test.ts`. Extracted rather than inlined because
  the repo has NO component-test infrastructure — `vitest.config.ts` is `environment: 'node'` with
  `include` limited to `.ts`, and there is no jsdom or testing-library — so a pure helper is the only
  part of that render a test can reach. The pixels still need the preview.
- `PaymentRow` in `shared.tsx` now carries the same marker, so a guest row in the payer's per-item
  history no longer reads as an unexplained second payment of their own fee. `truncate min-w-0`,
  because at 390px that row is already tight and an untruncatable name would push the status badge
  past the viewport.
- FIX from that review (non-security, found while tracing the guest name through every surface):
  `PaymentsSection.tsx` rendered a pending group card's beneficiary list from `r.beneficiary`, the
  `profiles!profile_id` embed. On a guest row that IS the payer, so a card for "me + guest Ivan"
  listed the payer's name twice instead of naming Ivan. GET `/api/payments` now selects
  `beneficiary_guest_id, payment_guests(id, name)`, `GenericPayment` declares both, and the card
  prefers the guest name with a `payment.guestTag` suffix. Same class as the admin-side fix already
  made in `PaymentGroupCard.tsx` / `PaymentsClient.tsx`.

## Open items
- NOT RUN: G4 (admin link/unlink) has no automated coverage and has never been exercised against a
  real database. `e2e/payments-guest.spec.ts` covers the member side only. Do it manually on the
  preview: `/admin/payments` → Guest links → pick a member → Link → Unlink.
- DONE: `e2e/payments-guest.spec.ts` PASSED in CI at `4c921ef` — `✓ 12 [authenticated] ›
  e2e/payments-guest.spec.ts:48:7 … (16.0s)`. Executed, not skipped, so the carried #676 worry about
  the payments E2E passing vacuously does not apply to this spec.
- The spec writes a real `payment_guests` row named `E2E Guest Nadia` on whichever database it runs
  against. It is uniquely indexed, so re-runs reuse the one row rather than accumulating — but on
  DEV it is a fixture that will need removing at GCR alongside `seed_676_*`.
- NOTED (not done): `app/(dashboard)/profile/types.ts:80` declares a SECOND `TripPayment` type,
  unrelated to the one in `app/(dashboard)/trips/[id]/page.tsx`. Left alone — no personal-balance
  reducer consumes it, so the guest correction does not apply, but the name collision is a trap.
- Deliberately NOT changed: `PaymentsSection.tsx:42` sums `amount` across a group INCLUDING guest
  rows. That is correct — it is the total of a transfer the payer made, shown on the withdraw card,
  not a personal balance.
- Carried from #676, still open: `e2e/payments-on-behalf.spec.ts` had never executed as of the #676
  merge — the seed extension in `scripts/seed-clerk-test-users.js` was EDITED-UNVERIFIED against a
  real database. Confirm on this PR's CI run that the payments E2E reports 0 skipped.
- Carried from #676, unmeasured: does PROD have `payments` rows? If yes, `/profile` was crashing in
  production for every such user between 2026-07-27 (`570d587`, #670) and the #676 merge. One
  read-only query answers it: `select count(*), count(distinct profile_id) from payments`.
- Carried NOTED (not done), unrelated to #677: trip payments display currency `'EUR'` by fallback
  (`PaymentsSection.tsx:43`, `shared.tsx:109` both read `payable_items?.currency ?? 'EUR'`, and a
  trip payment's `payable_items` is NULL); `shared.tsx:102` gates the cancelled-trip ⓘ on
  `payable_items?.item_type === 'trip'`, always false for a real trip payment;
  `shared.tsx:120` and `ArchivedView.tsx:70` render `proof_url` directly as an `href` although it is
  a storage KEY, not a URL, since `20260517000200` made `trip-proofs` private.
- DEV fixture `seed_676_*` (7 profiles, ABOs 6760001-6760004) is still present on DEV and is still
  needed for the E2E/manual passes. Its GCR cleanup was deferred by the user on 2026-07-31.

## Failed attempts
- ATTEMPT 1 [L1] — first CI run of PR #689: `390px smoke vs preview` FAILED (both the initial run and
  retry #1) with `The Clerk Frontend API URL is required to bypass bot protection`, thrown at
  `e2e/payments-guest.spec.ts:37` inside `clerk.signIn`. NOT a product bug and NOT a 390px layout
  failure: `playwright.config.ts` routes Clerk-authenticated specs to the `authenticated` project via
  three regexes, and the new spec was never added to them, so `mobile-390` collected it and ran it
  against a live Vercel Preview that has no Clerk secrets. The spec's own docstring already said it
  belonged to `authenticated`; the config was never told. Fixed by adding `payments-guest` to all
  three. Everything else in that run was green, `Build` included. FIXED — `390px smoke vs preview`
  passed on the re-run (2m22s).
- ATTEMPT 1 [L1] on a SECOND, different failure, exposed only once the routing fix let the spec run
  for the first time: `Authenticated E2E (Clerk)` failed at `payments-guest.spec.ts:117` with
  `strict mode violation: getByText(/guests \(no account\)/i) resolved to 2 elements`. A TEST bug,
  not a product bug — and the failure output is itself evidence the feature works, because element 2
  was the remembered guest's own row (`e2e-guest-nadia@example.com · Guests (no account)`). The
  picker prints the relation label as the section header AND inside every row's subtitle. The
  assertion above it — line 114, the actual memory requirement — PASSED, so add-guest → submit →
  withdraw → guest-survives is now proven end to end against a real database. Fixed by matching the
  header exactly. 18 other authenticated tests passed in that run. FIXED — `✓ 12 [authenticated] ›
  e2e/payments-guest.spec.ts:48:7 … (16.0s)`, `19 passed`, at `4c921ef`.
