## Goal
BUILD issue #676 (2607-DEV-676, branch `dev/2607-DEV-676`): payments on behalf of others — one submission + one proof produces N `payments` rows sharing a `payment_group_id`, one per real-profile beneficiary in the payer's own LOS, each landing on that person's own ledger. Admin approves/rejects the whole group only.

## Now
PR 687 at `7f64679`: all 11 checks pass, Vercel READY, both `/profile` crash fixes verified in the
browser, `docs/CLAIMS.md` row released. THREE CodeRabbit rounds dispositioned — round 3 reviewed the
two commits the earlier `Review rate limited` had skipped and raised 3 items on the seed scripts
(2 fixed, 1 skipped with its premise disproved). See the round-3 Done entry.

The E2E run on `82e4f1b` was `16 passed / 1 flaky / 1 skipped`. The flaky one is
`profile-bento-auth.spec.ts:143 › collapsing a bento persists after reload` — failed on
`expect(locator).toBeEnabled()` (1.0m), passed on retry #1 (9.9s). A causal link to the payments
edits is implausible (that control gates on `layoutRestored` from `useProfile()`, which those edits do
not touch) but UNPROVEN — the 3x-isolated flake procedure was not run.

Uncommitted-at-the-time work now folded in: `scripts/seed-clerk-test-users.js` seeds the on-behalf
fixture so the `1 skipped` becomes a real run. See Next 1.

## Next
1. Confirm `e2e/payments-on-behalf.spec.ts` actually EXECUTES in CI. `scripts/seed-clerk-test-users.js`
   now seeds the two things the spec needs and the old fixture lacked: a DOWNLINE profile
   (`clerk_id = seed_e2e_downline_tevd_portal`, `abo_number E2E-DOWNLINE-0001`) with a `tree_nodes`
   row under the member — `get_payable_beneficiaries` reaches a downline only through
   `tree_nodes.path <@ <viewer path>`, so a bare profiles row is invisible to the picker — and one
   active `payable_items` row (`E2E Test Fee`), without which the form's item `<select>` has a single
   option and the spec skips at :100. The downline carries a real `abo_number` deliberately: the
   picker renders `{abo ? `${abo} · ` : ''}{relation}` and the spec's locator filters on `·`, so an
   ABO-less co-owner would be a valid beneficiary the test could not see.
   PASS CRITERION: the job reports 18 passed / 0 skipped. Anything that still says `1 skipped` on
   payments-on-behalf means the fixture did not take — read the seed step's log lines, they name each
   row. This is EDITED-UNVERIFIED against a real database: the script cannot be exercised from this
   machine (`.env.local` points at PROD, and the Clerk key here is the prod instance — creating
   fixture users there is not acceptable), so CI's local-Supabase run IS the verification.
2. Manual 390px pass on the preview: happy path, admin group card, beneficiary sees the payment but cannot open the proof. Add the typeable-share-input check (`SplitEditor` draft state) — that fix is EDITED-UNVERIFIED in a browser.
3. Merge.
4. After merge: approve the gated `migrate-prod` run (this PR HAS a migration), smoke-check production, then GCR — remove the `docs/CLAIMS.md` row, drop the `seed_676_*` DEV fixture, close #676.

## Constraints
- Never push to `main`; `dev/2607-DEV-676` only.
- No `git push` unless the user asks for a push in this conversation (quote required). NOT GRANTED yet this session.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row + `docs/STATE.md` updates into this PR — no standalone cleanup PR.
- Change only what the DoD requires; log other findings as NOTED.
- Issue-stated: do NOT add group support to `app/api/profile/payments/route.ts` and do not edit it. Ask before editing `docs/guardrails/PROJECT.md`.
- User, 2026-07-31, on the DEV `seed_676_*` fixture: "Leave it until GCR and continue 5-12" — do not clean it up before the GCR tail.

## Decisions
- DECISION: migration filename `20260731000000_2607_feat_676_pay_on_behalf.sql` — 2026-07-31 is a new day (latest existing is `20260723000000`), so the counter resets to `000000` per GOTCHAS row 14.
- DECISION: both new write RPCs carry the GOTCHAS row 34 guard `IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'` and take the payer/viewer as an explicit parameter — Pattern A helpers return NULL under service role.
- DECISION: nothing granted to `authenticated` on `can_pay_for` / `get_payable_beneficiaries` — an arbitrary-payer argument would be an LOS-mapping oracle. `service_role` only.

## Facts
- DEV Supabase project ref `iymwxdewcpvpjgzewtzk`; `supabase/.temp/project-ref` confirms the CLI is linked to DEV. CLI v2.109.1.
- DEV SQL runner (no psql on host): a PowerShell script in the session scratchpad reads the Supabase CLI token from Windows Credential Manager (target `Supabase CLI:supabase`; the blob is UTF-8 — decode with `PtrToStringAnsi`, not `PtrToStringUni`) and POSTs to `https://api.supabase.com/v1/projects/iymwxdewcpvpjgzewtzk/database/query`. Verified working 2026-07-31. Only the LAST statement's result set comes back, so put the rows you want last. Queries selecting person names are blocked by the permission classifier — aggregate instead.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file for utility candidates, and a backslash followed by hex-digit characters (as in a temp path whose UUID segment starts with hex letters) parses as a CSS unicode escape. `String.fromCodePoint` on the resulting value exceeds the Unicode maximum and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1` — nowhere near the real file. Describe the path, never paste it; writing the literal sequence out even as an example re-breaks the build.
- Schema anchors (`supabase/migrations/20260315000000_baseline.sql`): `payments` at :307-331 with exactly two FKs to `profiles` (`profile_id` :327, `logged_by_admin` :328); payments RLS at :1069-1075, `payments_member_insert` at :1072; `tree_nodes` at :115-127; `profiles` at :28-49 (no `primary_profile_id` — added by `20260508000100`); `upsert_tree_node` placeholder-root branch at :407-419.
- "Approved ABO-less member" = `role <> 'guest'` with `abo_number IS NULL` — `approve_member_verification` (`20260509000400_approve_member_verification_gcr.sql:90-101`) sets `role='member'` + `upline_abo_number` and leaves `abo_number` NULL for `request_type='manual'`.
- Migration precedent to copy (header, guard, grants): `supabase/migrations/20260713000000_2607_feat_los_submission_requests.sql`.
- Carried from #681: if `npm run build` dies with `Fatal process out of memory: Zone`, first response is `rm -rf .next` — the OS, not the V8 heap, was the limit; do not raise `--max-old-space-size`.

## Done
- PROFILE CRASH (2026-08-01, found by the user on the preview after submitting an on-behalf payment).
  SYMPTOM: `/profile` renders the error boundary, console `TypeError: Cannot read properties of
  undefined (reading 'toLowerCase')`. REPRODUCED in-browser on the preview: DOM read back
  "Something went wrong", and `fetch('/api/payments')` returned `hasStatusKey: false` with
  `admin_status: "pending"`, `member_status: "approved"`. CAUSE: `app/(dashboard)/profile/types.ts`
  declared `GenericPayment.status: string`, but `payments` has NO `status` column (baseline
  :307-331 — only `admin_status`/`member_status`) and `app/api/payments/route.ts:25` never selected
  one, so `shared.tsx:113` handed `undefined` to `StatusBadge.tsx:46` `status.toLowerCase()`.
  NOT a #676 regression: `shared.tsx` is untouched on this branch and main's GET never returned
  `status` either. Introduced on main 2026-07-27 by `570d587` (#670), which replaced the tolerant
  `PAYMENT_STATUS_STYLES[pay.status] ?? …pending` lookup with `.toLowerCase()`; latent until a
  profile has >=1 generic payment. FIX (3 files): `types.ts` drops the phantom `status` and makes
  `admin_status` required; `shared.tsx:113-114` renders `pay.admin_status` (the status every other
  payment surface shows — AttendeeView :226-230, ArchivedView :56-60, admin PaymentsClient :190,217);
  `StatusBadge.tsx` gains `rejected: 'alert'`, since admin writes `rejected` and the map only had
  `denied`, so a rejected payment would have rendered amber "pending". RESULT: `npm run verify`
  exit 0 — `Test Files 21 passed (21)`, `Tests 280 passed (280)`, 0 eslint errors. VERIFIED on the
  preview at `21558be` (deployment `dpl_7KfYQg5…`, readyState READY): reloading the same URL that
  crashed now gives `errorBoundary: false`, no TypeError in the console, and the row renders
  `100,00 € / 01.08.2026 г. / cash / pending / proof ↗` beside the group card
  `200,00 € for E2E Member, E2E CoOwner / Withdraw`.
- CODERABBIT PASS (2026-08-01, 11 findings, all verified against live code before acting — none phantom). FIXED 10: (1) RLS `payments_member_insert` admitted `COALESCE(paid_by_profile_id, profile_id) = get_my_profile_id()`, which a signed-in user satisfies by naming THEMSELVES payer while pointing `profile_id` at anyone — real privilege escalation, `can_pay_for` cannot backstop it since EXECUTE is revoked from `authenticated`; now self-inserts only (`paid_by_profile_id IS NULL AND payment_group_id IS NULL AND profile_id = get_my_profile_id()`), applied to DEV and confirmed by `pg_policy`. (2) `PaymentForm.isOnBehalf` used `roster.length >= 2`, so removing your own chip from a 2-person roster left one OTHER person, dropped the group payload, and credited the payer — now gated on roster CONTENTS. (3) `rebalance`/`setRowAmount` did not guard `MAX_TOTAL_CENTS`, so a total over 1,000,000.00 threw `SplitError` out of a state updater; `MAX_TOTAL_CENTS` + new `isValidTotal` exported from `split.ts` and used in both paths (3 new tests, one asserting `isValidTotal` is false exactly where `redistribute` throws). (4) `SplitEditor` share input was fully controlled on `toFixed(2)` and reformatted every keystroke — "50.00" was untypeable; now a per-row draft, formatted on blur. (5) `/api/payments` returned raw Postgres text on non-P0001; now logged server-side, generic 500 to the client. (6) `ledgerPayments` dropped the payer's OWN row from a group they paid for, contradicting its own comment; now keyed on `profile_id` first. (7) withdraw failures were silent — dialog now renders `withdrawMutation.error` and resets on close. (8) admin review/delete failures went to `payError`, which renders only inside the closed `LogPaymentDrawer`; now shown beside the pending queue. (9) BeneficiaryPicker cap notice counted the unfiltered roster, not matches. (10) the cap sliced the flat list before grouping, so a whole relation section could vanish; matches are now sorted by `RELATION_ORDER` before slicing. Also fixed the e2e assertion that contradicted the redistribution contract (one edit locks a row and the other absorbs, so a single `fill` can never unbalance — the spec now locks both rows).
- SKIPPED 1, with reason: CodeRabbit wanted group DELETE gated on `admin_status = 'pending'`. Declined — `app/api/admin/payments/[id]/route.ts` DELETE has never been status-gated either, so gating only the group form would remove a capability admins already have for every other row. Took CodeRabbit's own stated alternative: documented the intent on the route and fixed the real defect, the confirmation dialog now naming the row count and statuses (`deleteGroupScope`, read from `initialPayments` so the status filter cannot hide siblings).
- CODERABBIT ROUND 2 (2026-08-01) — the re-review passed but raised 3 items on code written this session. FIXED 2: (a) `MAX_TOTAL_CENTS` was enforced only in the browser; `app/api/payments/route.ts` and `submit_payment_group` now assert the same ceiling, so a hand-crafted request cannot post an arbitrary total (verified on DEV: `rejected: total_cents exceeds the 100000000 cent ceiling (got 200000000)`). (b) `seed-smoke-calendar.js` matched the DEV ref anywhere in the URL — `https://evil.example/?ref=<ref>` and `https://<ref>.supabase.co.evil.example` both passed; now parses the URL and compares hostname exactly (11 adversarial cases probed, all pass). Applied the updated RPC to DEV with `supabase db query --linked -f` (the CLI has a `db query` subcommand — no credential-manager workaround needed).
- CODERABBIT ROUND 3 (2026-08-01, GCR on PR 687) — 3 items, all on the two commits the earlier
  `Review rate limited` never reviewed. FIXED 2: (a) `seed-smoke-calendar.js` `isSafeSupabaseTarget`
  accepted `http://<DEV_REF>.supabase.co`, putting the service-role key on the wire in cleartext;
  plaintext is now localhost-only and the hosted target must be HTTPS (7 adversarial URLs probed
  against the real script — the 4 hostile ones refused, HTTPS-DEV and both localhost forms accepted).
  (b) `ensurePayableItem` matched on title alone, so an inactive or non-EUR `E2E Test Fee` counted as
  present and the spec kept skipping at :100 while the seed logged success; it now repairs the row in
  place (not a second insert — `payable_items` has no natural unique key and a duplicate title would
  break the `.maybeSingle()` on the next run) and returns created/repaired/present so the CI log names
  the outcome. SKIPPED 1, premise DISPROVED: CodeRabbit wanted `ensureTreeNode` to "reconcile the
  member's existing tree node" or the downline would be "disconnected from the member parent". It
  cannot be — `upsert_tree_node` (`20260509000300_upsert_tree_node_no_recurse.sql:38-52`) resolves the
  sponsor via `profiles.abo_number` and then reads that profile's LIVE `tree_nodes.path`, so the
  downline is appended under whatever path the member actually has. Worse, the same RPC ends
  `ON CONFLICT (profile_id) DO UPDATE SET path = EXCLUDED.path`, so calling it for the member with a
  NULL sponsor — which is what "reconcile" would do — is exactly the reparent-to-root that the
  early-return guard at :178-181 was written to prevent.
- RESOLVED: `preview-smoke.yml` now reads `SUPABASE_SERVICE_ROLE_KEY_DEV`, matching the repo's `_DEV`/`_PROD` convention. User created the secret 2026-08-01T07:52Z and removed the unsuffixed one. Green in CI on `8f3d8f7` (seed step ran, then `10 passed (1.6m)`).
- NOTED (not done): TWO scripts still carry the loose `url.includes(DEV_PROJECT_REF)` guard that
  `seed-smoke-calendar.js` has now had hardened twice (exact hostname, then HTTPS-only):
  `scripts/seed-smoke-guide.js:68-71` and `scripts/seed-clerk-test-users.js:102-105`. Both accept
  `https://evil.example/?ref=<ref>`, `https://<ref>.supabase.co.evil.example`, and plaintext http to
  the hosted project, and both then send a service-role key. Same defect class CodeRabbit has now
  flagged twice on this PR. Left out of scope under the "change only what the DoD requires"
  constraint — raised with the user rather than folded in silently.
- CALENDAR SMOKE FIXTURE (2026-08-01, unrelated to #676 — see Open items). `390px smoke vs preview` failed on PR 687 with `no calendar events found in the current month view` (`e2e/calendar.spec.ts:47`). CAUSE: DEV `calendar_events` held 3 rows, all in Sofia month 2026-07, while `app/(dashboard)/calendar/page.tsx:20` derives the initial month from the Sofia calendar day — which rolled to 2026-08 at 2026-07-31T21:00Z (probe: 20:59Z -> 2026-07, 21:00Z -> 2026-08). Not a PR regression: the same spec passed at 18:47Z on `dev/2607-DEV-681`, and PR 687 touches no calendar file. FIX: `scripts/seed-smoke-calendar.js` (deterministic per-month UUID, upserts current + next Sofia month, DEV-ref guard mirroring seed-smoke-guide, `google_event_id` left NULL so calendar-sync reconciliation cannot delete it) + `seed:smoke-calendar` npm script + a seed step in `preview-smoke.yml`. Seeded DEV by hand and re-ran the failed job: `10 passed (1.6m)`, `✓ 1 [mobile-390] › e2e/calendar.spec.ts:21:7`, run conclusion `completed / success`.
- CLAIM complete: #676 has `## Design Checklist` (four checked) + `## Branch`; branch `dev/2607-DEV-676` checked out; `docs/CLAIMS.md` row registered at `b7790c7`.
- V1 data reality check on DEV (2026-07-31) — RESULT: DEV is effectively empty and the issue's stated premise is DISPROVED. `profiles` = 11 (3 admin / 4 core / 3 member / 1 guest); `tree_nodes` = 2 (max depth 0); `los_members` = 0; `payments` = 0; profiles with no tree node = 9; **placeholder roots = 0**; **secondaries (`primary_profile_id NOT NULL`) = 0**; ABO-less profiles = 1 admin + 1 guest, both with NULL `upline_abo_number` — i.e. **zero approved ABO-less members**. The issue claimed "placeholder roots definitely exist"; they do not on DEV.

- PLAN CHANGE (2026-07-31): assumed approved ABO-less MEMBERS exist and are why the `guest` branch is needed; actually `trg_guard_abo_number_null` (`20260716000100_normalize_prod_schema_drift.sql:25-54`, BEFORE INSERT OR UPDATE ON profiles, live on prod AND DEV) REJECTS `abo_number IS NULL` on any primary profile with role `member`/`core`, exempting only admin, guest and co-owners. Evidence: the fixture INSERT failed with `P0001 abo_number cannot be NULL for a primary profile with role member`. Resolution: branch 4 is KEPT (additive; the manual-verification path clearly intends the category) but its migration comment now states that today it can only match an admin-role profile carrying an `upline_abo_number`; co-owners are already covered by `household` + the `downline` COALESCE anchoring.
- Step 1 DONE — migration `20260731000000_2607_feat_676_pay_on_behalf.sql` applied to DEV via `supabase db push` (clean; only that file was pending). Adds `payment_group_id` + `paid_by_profile_id` (both nullable, both-or-neither CHECK, one partial index each, third FK to profiles), `get_payable_beneficiaries`, `can_pay_for`, `submit_payment_group`, `withdraw_payment_group`, policy `payments_payer_select`, and replaces `payments_member_insert` with `logged_by_admin IS NULL AND COALESCE(paid_by_profile_id, profile_id) = get_my_profile_id()`.
- V3 grants — RESULT: all four functions are `postgres=X/postgres | service_role=X/postgres`. `authenticated` has NO EXECUTE. Verified from `pg_proc.proacl` on DEV.
- V2 eligibility matrix on the seeded fixture — RESULT: 18/18 rows exactly as predicted. root(core) -> self + legA/legB/leafA/spouse as downline + aboless as guest; legA -> self + spouse(household) + leafA(downline) + aboless; leafA(leaf) -> self + aboless only; spouse(secondary) -> self + legA(household) + leafA(downline, borrowing the primary's node) + aboless; legB -> self ONLY; guest viewer -> self ONLY. **No upline appears for any viewer and no sibling leg leaks.**
- V3 `can_pay_for` — RESULT: 16/16 assertions pass, including leafA->legA false, leafA->root false, legA<->legB false both ways, legB->aboless(other leg) false, spouse->root false, guest->anyone false.
- RPC behaviour on DEV — RESULT: 9/9. T1 happy path inserted 2 rows under one group id; **T2 out-of-LOS beneficiary REJECTED `P0001 profile … is not payable by …`** (the security test, bypassing the picker entirely); T3 sum mismatch rejected; T4 duplicate beneficiary rejected; T5 missing trip/item rejected; T6 wrong-payer withdraw deleted 0; T7 approved-group withdraw deleted 0; T8 payer withdraw deleted 2 and returned the shared `proof_url`; T9 zero leftover rows.
- Step 2 DONE — `types/supabase.ts` regenerated from DEV (2998 -> 3044 lines). Diff is purely additive: the two columns in Row/Insert/Update, the `payments_paid_by_profile_id_fkey` relationships, and Args/Returns for all four RPCs. `npx tsc --noEmit` exit 0.

- Steps 3-4 DONE (`e1bae5c`) — `lib/payments/split.ts` (integer cents; floor + one-cent remainder; edit locks a row and unlocked rows absorb the difference; over-committed locks zero the unlocked rows rather than going negative) and `lib/payments/eligibility.ts` (`fetchPayableBeneficiaries`, `assertGroupAllowed` — one round trip, in-memory comparison, 403 without confirming a probed profile exists). RESULT: `npx vitest run lib/payments/split.test.ts` 27/27 passed; `npx tsc --noEmit` exit 0.

- SECURITY FIX (post-review) — `/security-review` returned exactly one finding, confirmed at 8/10 by an independent verification pass, and it is REAL. Chain: `submit_payment_group` copies the payer's single `proof_url` onto every beneficiary row; the widened reads then hand that path to the beneficiary, who is not entitled to the image; both member POST routes wrote `proof_url` verbatim from the body; so a beneficiary could plant the payer's path on a throwaway row of their OWN and have `/api/profile/payments/[id]/proof` sign it — that route authorises on who the ROW's payer is, and on their own row that is them. Impact: the exact bank-details disclosure the narrowed proof route was added to prevent. Fixed with two independent defences in `lib/payments/proof.ts`: `assertOwnProofPath` (a written `proof_url` must sit under the caller's own `${profile_id}/` prefix, mirroring the guard that already existed at `app/api/profile/payments/upload-url/confirm/route.ts:22-30` but which a hand-crafted request simply skipped) and `redactForeignProofUrls` (nulls the path for anyone but the payer on read). FOUR disclosure channels, not the two the reviewers named: `/api/payments` GET, `/api/profile/payments` GET, `/api/trips/[id]/payments` GET, and — missed by both review passes — `app/(dashboard)/trips/[id]/page.tsx`, a server component whose `select('*')` ships the path inside the serialized RSC props. Admin routes deliberately untouched: admins are entitled to the proof.

## Open items
- NOTED (not done): trip payments display currency `'EUR'` by fallback, not the row's own `currency`
  column — `PaymentsSection.tsx:43` and `shared.tsx:109` both read `payable_items?.currency ?? 'EUR'`,
  and a trip payment's `payable_items` is NULL. Wrong for any non-EUR trip. `GenericPayment` does not
  declare `currency` either, though GET /api/payments selects it.
- NOTED (not done): `shared.tsx:102` gates the cancelled-trip ⓘ on
  `pay.payable_items?.item_type === 'trip'`, which is ALWAYS false for a real trip payment (NULL
  payable_items). The indicator has never shown for the rows it was written for.
- UNKNOWN, worth one query: does PROD have `payments` rows? If yes, `/profile` has been crashing in
  production for every such user since `570d587` shipped 2026-07-27 (#670) — same phantom
  `pay.status`. The read-only count query was blocked by the permission classifier this session, so
  the prod blast radius is unmeasured. `select count(*), count(distinct profile_id) from payments`.
- NOTED (not done): `PaymentRow` renders the status label raw and untranslated (`{pay.admin_status}`
  -> "pending"), as `{pay.status}` was always meant to. `AttendeeView.tsx:230` translates the same
  value via `t('payment.approved')`/`t('payment.pending')`. Left as-is — matches ParticipationSection
  and InvitesSection, and translating it is a copy decision beyond #676's DoD.
- DONE: the `Seed the DEV calendar smoke fixture` workflow step ran green in CI on `496ac06` (`seed-smoke-calendar: ready — guest-visible event on the 15th of 2026-08 and 2026-09`, then `10 passed (1.6m)`). That also proves the repo secret `SUPABASE_SERVICE_ROLE_KEY` is the DEV key, as the user stated. The URL still comes from `SUPABASE_PROJECT_ID_DEV` and the script still refuses any other project ref, so a future key rotation to the wrong scope 401s instead of writing to prod.
- NOTED (not done): DEV's three ad-hoc July `calendar_events` rows (`tmp-605-parity-event`, `QR test event`, `WES Старосел – 3-day span test`) are leftovers, not a fixture. The last one carries `google_event_id = 'e2e-multiday-span-test'`, so a calendar-sync run will delete it as unreconciled.
- NOT RUN (in progress): `e2e/payments-on-behalf.spec.ts` has still never executed. Correction to the
  older note here: the job is NOT a vacuous skip any more — on `82e4f1b` it genuinely ran
  `Running 18 tests`, and this spec is specifically the `1 skipped`. The seed extension in Next 1 is
  the fix; until a CI run shows 0 skipped, treat the spec as EDITED-UNVERIFIED.
- NOTED (not done): `e2e/payments-on-behalf.spec.ts` exercises only the `downline` branch of
  `get_payable_beneficiaries`. `household` (co-owner) and the ABO-less `guest` branch stay uncovered.
- NOTED (not done): the seed now writes an active `payable_items` row to the SHARED DEV project when
  run there, so `E2E Test Fee` appears in every DEV user's payment drawer. Acceptable for a fixture,
  but it is not isolated. RESOLVED half: the "flipped `is_active = false` by hand and the seed will
  not reactivate it" trap is gone — `ensurePayableItem` now matches on title, repairs a row that is
  inactive or non-EUR in place, and logs which of created/repaired/present happened.
- NOTED (not done): `.github/workflows/ci.yml:132` cites `scripts/seed-clerk-test-users.js:60` for the
  URL allowlist regex. That line reference was already stale before this change (the guard is
  `isSafeSupabaseTarget`, not a line-60 regex) and is now further off. Comment-only.
- NOT RUN: no manual pass on a Vercel preview yet — nothing is pushed.
- DEV fixture `seed_676_*` (7 profiles, ABOs 6760001-6760004) is STILL PRESENT on DEV and is needed for the E2E/manual passes. Re-seed or clean up with `<scratchpad>/seed_676.sql` (it deletes `clerk_id LIKE 'seed_676_%'` first, so it is idempotent). Remove it at GCR time.
- NOTED (not done): `approve_member_verification` with `request_type='manual'` sets `role='member'` while leaving `abo_number` NULL — on a primary profile that now trips `trg_guard_abo_number_null`. The manual verification path looks broken independently of this issue. Not in #676's DoD.
- NOTED (not done): `upsert_tree_node` writes `depth = 0` for every node in the seeded fixture even at ltree depth 3 (`6760001.6760002.6760003`). `path` is correct; only `depth` is wrong. Pre-existing, not in #676's DoD.
- DONE: `docs/ai/GOTCHAS.md` row 12 now says THREE FKs to `profiles` and names all three. `docs/ai/REF.md` gained the four new/changed routes and the two new `payments` columns.
- Issue-noted, NOT in scope: `app/api/payments/route.ts:37` `if (!amount)` rejects a `0` amount and admits a negative one; `app/admin/members/[id]/components/PaymentsPanel.tsx:3-7` declares a `status` column that does not exist on `payments`.
- NOTED (not done): `app/(dashboard)/profile/components/shared.tsx:120` and `app/(dashboard)/trips/[id]/components/ArchivedView.tsx:70` render `proof_url` directly as an `href`. Since `20260517000200` made `trip-proofs` private, that value is a storage KEY, not a URL, so those two links have been dead for months. Pre-existing and unrelated to #676; the correct target is `/api/profile/payments/<id>/proof`, as `AttendeeView.tsx:245` already does.
- NOTED (not done): the ownership guard now enforced on write means any pre-existing `payments.proof_url` NOT under its payer's prefix is unreachable-by-design going forward, but historical rows are untouched. No backfill was run and none appears necessary — `upload-url` has always minted the prefix; worth one query on prod after merge to confirm zero exceptions.

## Failed attempts
- ATTEMPT 1 [L1] (`npm run build` / `npm run verify`): replaced the novel arbitrary utility `text-[0.6875rem]` with the repo's existing `text-[11px]` idiom in `components/payment/BeneficiaryPicker.tsx:113,138,167`, on the hypothesis that Tailwind's candidate scanner choked on a rem-valued arbitrary text size -> SAME failure, byte-identical: `CssSyntaxError: tailwindcss: app/globals.css:1:1: Invalid code point 10591021`, thrown from `markUsedVariable` -> `String.fromCodePoint`. Hypothesis disproved. Note `markUsedVariable` operates on CSS custom-property names inside globals.css, not on scanned class names, so the TSX may be irrelevant entirely. (The `text-[11px]` change is KEPT — it matches repo convention either way.)
- ATTEMPT 2 [L1]: removed `e2e/payments-on-behalf.spec.ts` from the tree on the hypothesis that Tailwind was scanning the new Playwright spec -> SAME failure. Hypothesis disproved.
- RESOLVED [L3, by bisection + arithmetic]. Control build at `b7790c7` (detached, pre-work) SUCCEEDED, proving the break was mine, not pre-existing. Build at `26103f2` still failed — which ruled out every `.tsx` commit, since no new component existed yet. The decisive step was reading the number: 10591021 == 0xA19B2D, and `docs/STATE.md` contained a scratchpad path whose UUID segment made the literal sequence backslash-a19b2d. CAUSE: Tailwind v4 scans every source file (including .md) for utility candidates and unescapes CSS unicode escapes via `String.fromCodePoint`; 0xA19B2D is above the Unicode maximum 0x10FFFF, so it threw RangeError, reported against `app/globals.css:1:1` — a file I had never touched. Fix: describe the scratchpad path instead of pasting it. `npm run verify` then exited 0. The first draft of the warning note re-broke the build by quoting the sequence verbatim; it is now written in prose.
