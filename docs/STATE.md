## Goal
BUILD issue #625 (2608-DEV-625, branch `dev/2608-DEV-625`): replace the two JS-side
count-then-decide guest-invite rate limits with ONE atomic `SECURITY DEFINER` RPC
(`consume_rate_limit`) over a self-pruning `rate_limit_events` ledger, so a parallel burst is
actually capped instead of every caller reading the same stale count.

## Now
PR #693 is OPEN and NOT a draft (the user marked it ready_for_review at 2026-08-04 14:46Z from the
GitHub UI). All 9 CI checks green. CodeRabbit's single pass returned 3 inline comments; all 3 are
applied and pushed as one batched commit. Awaiting CodeRabbit's re-review, then merge.

## Next
1. Confirm CodeRabbit's incremental re-review is clean and all 3 threads are resolved.
2. Merge #693 — needs the user's explicit go-ahead.
3. Post-merge: drop the `docs/CLAIMS.md` #625 row, close #625.
4. PROD TAIL, in this order: approve #677's pending `migrate-prod` run FIRST (it has never landed),
   then #625's. Smoke-check `https://www.teamenjoyvd.com`.
5. ONLY after #625's migration is confirmed applied on prod: open + action the issue to delete the
   `PGRST202`/`42883` fallback from `lib/rate-limit.ts`. It CANNOT be removed at GCR time — between
   merge and migrate-prod approval, prod runs the new code against a schema with no
   `consume_rate_limit`, and the guards fail closed on a public flow.

## Next (original build order, all done)
1. Step 1: write `supabase/migrations/20260804000000_2608_feat_625_atomic_rate_limits.sql`
   (table + RPC + grants + nightly cron sweep + `-- ROLLBACK:` header). Check: file reads back
   clean; real check is step 5's `supabase db push`.
2. Step 2: rewrite `lib/rate-limit.ts` — `checkEmailCap` -> `consumeEmailCap`,
   `checkRegistrationThrottle` -> `consumeRegistrationSlot`, both calling the RPC, both
   fail-closed, plus the transitional `PGRST202`/`42883` fallback to the old count path.
   Check: `npm run check-types`.
3. Step 3: REFERENCE SWEEP + call sites — `lib/actions/guest-registration.ts:12,112,192,278,287`
   and `lib/notifications/guest-event-changes.ts:12,99,138`. Check: `npm run check-types`.
4. Step 4: tests — new `lib/rate-limit.test.ts`; switch `guest-registration.test.ts` and
   `guest-event-changes.test.ts` to module-mock the new export names. Check:
   `npx vitest run lib/rate-limit lib/actions/guest-registration.test.ts lib/notifications/guest-event-changes.test.ts`.
5. Step 5: `supabase db push` to DEV, regenerate `types/supabase.ts`, run the 40-parallel
   concurrency proof (exactly 30 true), `npm run lint` + `npm run build`.
6. `/code-review low` on the diff (auth/RLS/migration -> escalate per BUILD.md), then ASK the
   user before any push.

## Constraints
- Never push to `main`; `dev/2608-DEV-625` only. The branch has NO upstream configured
  (`git rev-parse --abbrev-ref @{u}` -> fatal), so a bare `git push` cannot hit main.
- No `git push` unless the user asks for a push in THIS conversation, quoted beside the command.
  GRANTED 2026-08-04, verbatim: "draft PR, commit everything necessary". Scope: commit the #625
  work, push `dev/2608-DEV-625`, open the PR AS A DRAFT. Does NOT cover marking the PR ready for
  review or merging — ask again for both.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- Issue-stated: preserve existing scoping exactly — email+template for the 3/h resend cap, email
  alone for the 10/day cap, `share_link_id` else `event_id` for the 30/h throttle — and preserve
  fail-closed-on-error.
- Issue-stated `NOTED (not done)`: the two `consumeEmailCap` calls in `resendGuestLink` keep their
  current order (daily cap second, so a daily-blocked recipient burns an hourly slot). Do NOT
  reorder — the tests deliberately assert that order.
- No RLS policy is written on `rate_limit_events` at all (deny-by-default, service-role only), so
  the Pattern A / `auth.jwt()` trap is avoided by construction.

## Decisions
- DECISION (PLAN 2026-08-04): ledger + advisory lock, NOT a fixed-window counter table. A counter
  keyed by `(key, bucket)` turns the sliding window into a fixed one and lets a burst straddling a
  bucket boundary pass `2 x max`; the current guards are sliding and the issue requires preserving
  them.
- DECISION (PLAN 2026-08-04): the counting source moves off `notification_delivery_log` /
  `guest_registrations` onto the new ledger — that move is what makes check-and-act one statement.
  Two intended behavior changes follow (see Facts).
- DECISION (PLAN 2026-08-04): rename `check*` -> `consume*` is mandatory, not cosmetic. Calling a
  consuming operation `check` invites a double-call that burns two slots.
- DECISION (PLAN 2026-08-04): ship the migration and the code in ONE PR with a `PGRST202` fallback,
  rather than a migration-only PR followed by a code-only PR. Vercel deploys on merge while
  `migrate-prod` waits for manual approval, so prod would briefly run new code against a schema
  with no `consume_rate_limit` — and these guards fail CLOSED, which would deny every guest
  registration and guest email on a public flow. The fallback closes that window; the two-PR
  alternative costs a second full CI/preview cycle.
- DECISION (BUILD 2026-08-04): `guest-registration.test.ts` and `guest-event-changes.test.ts`
  module-mock `@/lib/rate-limit` (prior art: `guest-event-changes.test.ts:17-19` already does),
  rather than driving the caps through the Supabase client fixture. The RPC no longer issues a
  count query, so the fixtures' `notification_delivery_log` branches and their count-call-index
  bookkeeping (`buildCapacityClient` assumes the throttle count runs BEFORE the capacity count)
  would otherwise all be wrong. Key/window/max assertions live in the new `lib/rate-limit.test.ts`.

## Facts
- BUILD BASELINE, captured 2026-08-04 before any edit:
  `npx vitest run lib/actions/guest-registration.test.ts lib/notifications/guest-event-changes.test.ts`
  -> `Test Files 2 passed (2)`, `Tests 33 passed (33)`. Green, despite the old STATE.md's
  "guest-registration.test.ts is flaky" note.
- Branch `dev/2608-DEV-625` @ `b39773e`, clean, NO upstream configured.
- DEV Supabase project ref `iymwxdewcpvpjgzewtzk`. Migrations: `supabase db push`. Types:
  `supabase gen types typescript --project-id iymwxdewcpvpjgzewtzk > types/supabase.ts` — run the
  redirect through Git Bash, NOT PowerShell `Out-File -Encoding utf8` (CRLF+BOM rewrites ~3100 lines).
- Migration filename counter: `supabase/migrations/` has no `20260804*` file (last is
  `20260801000000`), so today starts at `000000`.
- Two INTENDED behavior changes, both stated in the issue: (1) the registration throttle now counts
  SUBMISSIONS, not distinct registrants — `guest_registrations` is upserted on `(event_id, email)`,
  so a re-submitting guest never incremented the old count, which is exactly why a scripted burst
  slid under it; (2) a slot is consumed at check time, not send time, so a later
  `sendTransactionalEmail` failure (`lib/actions/guest-registration.ts:221`) spends the slot anyway.
- Key symbols: guards -> `lib/rate-limit.ts:7,44`; call sites ->
  `lib/actions/guest-registration.ts:112,192,278,287` and
  `lib/notifications/guest-event-changes.ts:99,138`; limits ->
  `guest-registration.ts:44-47,246-248`, `guest-event-changes.ts:20-21`.
- Structural prior art: `supabase/migrations/20260714000000_2607_feat_claim_los_submissions.sql`
  (SECURITY DEFINER + `auth.role()` guard + REVOKE/GRANT), `20260705000900_notification_cron.sql`
  (pg_cron unschedule-then-schedule), `20260801000000_2607_feat_677_pay_guests.sql`
  (`-- ROLLBACK:` header + table style).
- If `npm run build` dies with `Fatal process out of memory: Zone`, first response is `rm -rf .next`
  — the OS, not the V8 heap, is the limit. Do NOT raise `--max-old-space-size`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash + hex digits parses as a CSS unicode escape
  and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1`.
- E2E coverage for #625: none, by design — server-side abuse guard, no UI surface, nothing renders
  differently at 390px. Verification is vitest + the DEV concurrency proof.

## Done
- CLAIM #625 (2026-08-04) — RESULT: complete. Issue #625 carries `## Design Checklist` 4/4 and
  `## Branch`; `docs/CLAIMS.md` row committed at `b39773e` (which also pruned the merged #690 row).
- PLAN #625 (2026-08-04) — RESULT: READY. Verdict, DoD, affected files, gotchas and the two
  behavior-change notes are in the issue body.
- BUILD #625 steps 1-5 (2026-08-04) — RESULT: code-complete and verified.
  `npx vitest run lib/rate-limit.test.ts lib/actions/guest-registration.test.ts lib/notifications/guest-event-changes.test.ts`
  -> 3 files / 45 tests passed (baseline was 2 / 33; +12 in the new `lib/rate-limit.test.ts`).
  `npm run check-types` -> clean. `npm run lint` -> 0 errors, 475 warnings (baseline 476, all
  pre-existing); `npx eslint` on all six changed TS files -> zero output. `npm run build` -> success.
  Migration applied to DEV via `supabase db push`; `types/supabase.ts` regenerated (+22 lines only,
  no CRLF/BOM rewrite) carrying `rate_limit_events` and `consume_rate_limit`.
- CONCURRENCY PROOF #625 (2026-08-04) — RESULT: PASSED, stronger than the DoD asked.
  Driven by 40 pg_cron jobs on a '10 seconds' schedule against key `test:cronproof-1`,
  `consume_rate_limit(key, 3600000, 30)`: 5 rounds x EXACTLY 40 callers firing in the same second
  (`date_trunc('second', start_time)` buckets: 11:49:24, :34, :44, :54, 11:50:04), 200 runs across
  200 distinct backends, 0 job failures — and `rate_limit_events` held EXACTLY 30 rows for the key.
  Over-issue would have shown as >30. Object-level guards verified on DEV in the same session:
  `rls_enabled=true`, `policy_count=0`, function `prosecdef=true`, function ACL
  `postgres=X | service_role=X` (no PUBLIC/anon/authenticated), table ACL free of anon/authenticated,
  and `rate-limit-events-sweep @ 15 3 * * *` scheduled. All proof jobs unscheduled and all proof
  rows deleted afterwards (`remaining_jobs=0`, `total_rows=0`).

## Open items
- FLAKE, seen once on PR #693's CI, NOT caused by #625: `e2e/payments-on-behalf.spec.ts:169`
  ("L3: a row someone else paid for me is labelled with the payer") failed a `toBeVisible()` at
  36.3s then passed on retry #1 in 6.2s — a cold-server timing profile, same file and same shape as
  the L8 flake logged during #688. The run was otherwise honest: `Running 21 tests using 2 workers`
  -> `20 passed`, `1 flaky`, **0 skipped**, so this was NOT the vacuous green tracked as #679.
  #625 touches rate limiting only; that spec asserts payment attribution labels.
- At GCR: open a follow-up issue to REMOVE the transitional `PGRST202`/`42883` fallback from
  `lib/rate-limit.ts` once `consume_rate_limit` is live in prod. The fallback is dead weight after
  that and silently re-opens the race if it ever fires.
- OPEN — the `price_checker` DB role. A dormant, unversioned LOGIN credential on DEV only.
  DEV-ONLY: the user confirmed 2026-08-04 it does NOT exist on prod. On DEV `iymwxdewcpvpjgzewtzk`
  it is a LOGIN role WITH A PASSWORD SET (`pg_authid.rolpassword is not null`), not superuser,
  `rolbypassrls = false`, no role memberships, owns 0 objects, no password expiry, no connection
  limit. It is the ONLY non-Supabase-standard role on the project (the others —
  `cli_login_postgres`, `supabase_etl_admin`, `supabase_functions_admin`,
  `supabase_privileged_role` — are all stock).
  IT HAS BEEN USED, EXACTLY ONCE, AND NEVER SINCE. `pg_stat_statements` holds 4 statements for its
  `userid`, and `stats_since` dates every one of them to **2026-07-29**:
    11:09:04.100 — `select b.oid, b.typarray from pg_catalog.pg_type a left join ... where
                    a.typcategory = $1 group by b.oid, b.typarray order by b.oid`  (2 calls)
    11:09:04.169 — `SELECT current_user, current_database(), current_schemas($1)`  (1 call)
    11:09:04.231 — `SELECT table_schema,table_name FROM information_schema.tables
                    WHERE table_name IN ($1,$2)`                                    (1 call)
    11:13:34.884 — `SELECT datname FROM pg_database WHERE datistemplate=$1`         (1 call)
  That is a client-library/GUI CONNECTION HANDSHAKE, not application traffic: type-catalog
  bootstrap, identity probe, an existence check for two specific named tables, then a
  list-databases 4.5 minutes later. Zero queries against any business table, ever. So: someone
  pointed a tool at the DEV database as this role on 2026-07-29, it introspected, and it was never
  used again. Literals are normalised to $1/$2 so WHICH two tables it looked for is not recoverable.
  Grants: `arwdDxtm` on ALL 41 public tables. Old tables came from an explicit
  `GRANT ALL ON ALL TABLES IN SCHEMA public`; NEW tables (including `rate_limit_events`) come from
  an `ALTER DEFAULT PRIVILEGES IN SCHEMA public` rule owned by `postgres` that lists it beside
  anon/authenticated/service_role for both TABLES and SEQUENCES — so every table this repo will
  ever create is auto-granted to it.
  NOT a #625 regression; #625 merely inherits the default-privileges rule, and RLS (enabled, zero
  policies, `rolbypassrls = false`) still blocks it from `rate_limit_events`. It CAN read every
  pre-existing table whose RLS policies admit it.
  DECIDE: revoke it (`DROP ROLE price_checker` + drop the default-privileges entry) or, if the tool
  is wanted, recreate it in a migration with least-privilege grants so it stops being invisible.
  Either way it is a separate ticket, not #625.
- CARRIED FROM #677, NOT DONE — the prod tail. PR #689 is merged (`5311a9c` on `main`) but the
  post-merge sequence was never executed: approve the gated `migrate-prod` run (GitHub Actions,
  `production` environment, manual approval — #677 HAS a migration), confirm it applied,
  smoke-check `https://www.teamenjoyvd.com`, then close issue #677. #625 ALSO has a migration, so
  its gated run will queue behind the same approval.
- CARRIED FROM #677, NEVER VERIFIED: admin guest link/unlink has NO automated coverage and has
  never been exercised against a real database. Do it by hand: `/admin/payments` -> Guest links ->
  pick a member -> Link -> Unlink.
- CARRIED FROM #677: DEV fixtures still present and uncleaned — `seed_676_*` (7 profiles, ABOs
  6760001-6760004) and a `payment_guests` row named `E2E Guest Nadia`. Both still needed by the
  authenticated E2E.
- CARRIED FROM #676, UNMEASURED: does PROD have `payments` rows? If yes, `/profile` was crashing in
  production for every such user between 2026-07-27 (`570d587`, #670) and the #676 merge. One
  read-only query answers it: `select count(*), count(distinct profile_id) from payments`.
- NOTED (not done): `app/(dashboard)/profile/components/PaymentsSection.tsx:30`
  `pendingGroupsIPaidFor` filters `paid_by_profile_id !== myProfileId` directly rather than through
  `payerOf`, so a legacy pending group with a NULL `paid_by_profile_id` is not offered a withdraw
  card.
- NOTED (not done): `app/(dashboard)/profile/components/shared.tsx:103` gates the cancelled-trip
  info marker on `payable_items?.item_type === 'trip'`, always false for a real trip payment (its
  `payable_items` is NULL). Same file `:131-133` renders `proof_url` as an `href` although it is a
  private-bucket storage KEY, not a URL (`lib/payments/proof.ts:1-10`).
- The CI check `Authenticated E2E (Clerk)` has historically gone green in seconds WITHOUT running
  the specs (tracked as #679). Never treat a green tick as proof: confirm the run reports 0 skipped.

## Done (GCR)
- GCR PR #693 (2026-08-04) — RESULT: all 3 CodeRabbit inline comments applied in ONE batch.
  (1) MAJOR/security, `lib/rate-limit.ts:40` — the failure log wrote the whole bucket key, which
  embeds the recipient email (CWE-532). Now logs `{ scope, key: keyDigest(key) }` — a 12-char
  SHA-256 prefix — so repeated failures for one recipient still correlate without recording who.
  Backed by a regression test PROVEN RED first: reverting the fix gave
  `AssertionError: expected '["consume_rate_limit failed, denying"…' not to contain 'jane@example.com'`.
  (2) MINOR/correctness, `lib/rate-limit.ts:66,90` — truthiness checks on `template` / `shareLinkId`,
  a direct CLAUDE.md iron-rule violation. Now `template != null` / `shareLinkId !== null`. The SAME
  defect class was folded in for the two legacy fallback functions, which must scope identically or
  the fallback would count a different bucket than the RPC path.
  (3) MAJOR/performance, migration — `idx_rate_limit_events_key_created` leads with `bucket_key` and
  cannot serve the nightly sweep's global `created_at` predicate; since `bucket_key` is composed
  from a public form's email field, an abuser can mint unlimited distinct keys whose rows only the
  sweep ever collects. Added `idx_rate_limit_events_created_at` in a SEPARATE migration
  (`20260804000100`) rather than editing `20260804000000`, which is already applied on DEV — both
  ship in the same PR so prod applies them together. Verified on DEV: all 3 indexes present.
  Re-verified after the fixes: 45 tests -> 46 (13 in `lib/rate-limit.test.ts`), `tsc --noEmit`
  clean, `npx eslint` on the changed files silent.

## Failed attempts
Both are about the PROOF HARNESS only — no attempt failed against the migration or the TS code.
- ATTEMPT 1 [L1]: ran 40 parallel `supabase db query --linked` after `cd`-ing to the script's own
  directory -> all 41 invocations returned
  `{"code":"LegacyProjectNotLinkedError","message":"Cannot find project ref"}`. The CLI resolves
  the ref from `<cwd>/supabase/.temp/project-ref`. Fix: `supabase --workdir <repo> ...`.
- ATTEMPT 2 [L1]: same 40-process shape with `--workdir` -> only 25 of 40 sessions ever returned a
  verdict; the other 15 hung for 12+ minutes with empty output files. The Management API will not
  serve 40 simultaneous sessions. Structural change (D7), not a third retry: drive the callers from
  INSIDE Postgres with pg_cron background workers and read the verdict off the ledger row count.
  That is the run recorded under Done.
- ATTEMPT 3 [L1]: put `cron.schedule` x40, `pg_sleep(20)` and the measurement in ONE `-f` file ->
  `job_runs = 0`. The Management API runs a file as a single transaction, so the `cron.job` inserts
  were invisible to the pg_cron scheduler until COMMIT — which happened after the sleep. Fix: split
  scheduling and measurement into separate calls/transactions.
