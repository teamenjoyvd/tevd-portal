## Goal
BUILD issue #676 (2607-DEV-676, branch `dev/2607-DEV-676`): payments on behalf of others — one submission + one proof produces N `payments` rows sharing a `payment_group_id`, one per real-profile beneficiary in the payer's own LOS, each landing on that person's own ledger. Admin approves/rejects the whole group only.

## Now
Steps 1-4 of the issue's 12 are DONE and verified (see Done): the schema + RPCs are live on DEV, types are regenerated, and the pure lib layer is unit-tested. Commits `45e7143` (migration + types) and `e1bae5c` (lib). Nothing pushed. Next up is step 5, the member API.

## Next
5. Member API: `app/api/payments/route.ts`, `beneficiaries/route.ts`, `group/[groupId]/route.ts`, proof-route narrowing.
6. Admin API: group route, 409 guards, select-string extension, approval notification.
7. `lib/types/payments.ts` + i18n keys in `lib/i18n/domains/payment.ts` (every locale).
8. `BeneficiaryPicker.tsx`, `SplitEditor.tsx` standalone.
9. `PaymentForm` `allowOnBehalf` wiring; both existing call sites unchanged flag-off.
10. Enable at `AttendeeView.tsx` + `PaymentsSection.tsx`; withdraw card.
11. Admin UI (`PaymentGroupCard.tsx`, `PendingPaymentsSection.tsx`, `PaymentsClient.tsx`).
12. `npm run verify`, then `/code-review low`, then draft PR.

## Constraints
- Never push to `main`; `dev/2607-DEV-676` only.
- No `git push` unless the user asks for a push in this conversation (quote required). NOT GRANTED yet this session.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row + `docs/STATE.md` updates into this PR — no standalone cleanup PR.
- Change only what the DoD requires; log other findings as NOTED.
- Issue-stated: do NOT add group support to `app/api/profile/payments/route.ts` and do not edit it. Ask before editing `docs/guardrails/PROJECT.md`.

## Decisions
- DECISION: migration filename `20260731000000_2607_feat_676_pay_on_behalf.sql` — 2026-07-31 is a new day (latest existing is `20260723000000`), so the counter resets to `000000` per GOTCHAS row 14.
- DECISION: both new write RPCs carry the GOTCHAS row 34 guard `IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'` and take the payer/viewer as an explicit parameter — Pattern A helpers return NULL under service role.
- DECISION: nothing granted to `authenticated` on `can_pay_for` / `get_payable_beneficiaries` — an arbitrary-payer argument would be an LOS-mapping oracle. `service_role` only.

## Facts
- DEV Supabase project ref `iymwxdewcpvpjgzewtzk`; `supabase/.temp/project-ref` confirms the CLI is linked to DEV. CLI v2.109.1.
- Read-only DEV SQL runner (no psql on host): `C:\Users\fefence\AppData\Local\Temp\claude\D--react-teamenjoyvd-tevd-portal\a19b2d80-0672-475c-8d5a-09b6ba23078c\scratchpad\devsql.ps1 -Sql "<sql>"` — reads the CLI token from Windows Credential Manager (`Supabase CLI:supabase`, UTF-8 blob) and POSTs to the Management API. Verified working 2026-07-31. Queries selecting person names are blocked by the permission classifier — aggregate instead.
- Schema anchors (`supabase/migrations/20260315000000_baseline.sql`): `payments` at :307-331 with exactly two FKs to `profiles` (`profile_id` :327, `logged_by_admin` :328); payments RLS at :1069-1075, `payments_member_insert` at :1072; `tree_nodes` at :115-127; `profiles` at :28-49 (no `primary_profile_id` — added by `20260508000100`); `upsert_tree_node` placeholder-root branch at :407-419.
- "Approved ABO-less member" = `role <> 'guest'` with `abo_number IS NULL` — `approve_member_verification` (`20260509000400_approve_member_verification_gcr.sql:90-101`) sets `role='member'` + `upline_abo_number` and leaves `abo_number` NULL for `request_type='manual'`.
- Migration precedent to copy (header, guard, grants): `supabase/migrations/20260713000000_2607_feat_los_submission_requests.sql`.
- Carried from #681: if `npm run build` dies with `Fatal process out of memory: Zone`, first response is `rm -rf .next` — the OS, not the V8 heap, was the limit; do not raise `--max-old-space-size`.

## Done
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

## Open items
- DEV fixture `seed_676_*` (7 profiles, ABOs 6760001-6760004) is STILL PRESENT on DEV and is needed for the E2E/manual passes. Re-seed or clean up with `<scratchpad>/seed_676.sql` (it deletes `clerk_id LIKE 'seed_676_%'` first, so it is idempotent). Remove it at GCR time.
- NOTED (not done): `approve_member_verification` with `request_type='manual'` sets `role='member'` while leaving `abo_number` NULL — on a primary profile that now trips `trg_guard_abo_number_null`. The manual verification path looks broken independently of this issue. Not in #676's DoD.
- NOTED (not done): `upsert_tree_node` writes `depth = 0` for every node in the seeded fixture even at ltree depth 3 (`6760001.6760002.6760003`). `path` is correct; only `depth` is wrong. Pre-existing, not in #676's DoD.
- `docs/ai/GOTCHAS.md` row 12 says `payments` has two FKs to `profiles`; must become three in this PR.
- Issue-noted, NOT in scope: `app/api/payments/route.ts:37` `if (!amount)` rejects a `0` amount and admits a negative one; `app/admin/members/[id]/components/PaymentsPanel.tsx:3-7` declares a `status` column that does not exist on `payments`.

## Failed attempts
- (none this session)
