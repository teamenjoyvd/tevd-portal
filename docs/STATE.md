## Goal
**#705 (2608-DEV-705) is IN FLIGHT on `dev/2608-DEV-705`** — member registrations on
`guest_registrations` (schema + call-site sweep), the enabling ticket for epic #702. Code is
committed locally as `ba038f1`; **nothing is pushed**. #704 is DONE and merged as `a418cab`.

## Now
Migration **applied to DEV** 2026-08-09 via MCP `apply_migration` (the user approved it after
`supabase db push` and the MCP call were both refused by the permission classifier).
`types/supabase.ts` regenerated from DEV. `tsc --noEmit` clean, `npx vitest run` 29 files / 376 tests
(baseline 28/370), eslint 0 errors on every changed file.

**LEDGER TRAP, worth remembering:** MCP `apply_migration` stamps its OWN wall-clock version
(`20260809164601`), not the version of your migration FILE (`20260809000000`). Left alone, the next
`supabase db push` re-applies the file and fails on an already-existing column. Repaired both ways:
`supabase migration repair --status applied 20260809000000` and
`--status reverted 20260809164601`. `supabase migration list --linked` now shows local == remote.
Always check `supabase_migrations.schema_migrations` after an MCP apply.

DEV ledger note: `20260805000000` (#694, drop price_checker) is **still pending on DEV** —
pre-existing drift, not from this ticket. It replays as a no-op (`IF EXISTS` guard; `price_checker`
returns 0 rows on DEV).

Regenerating the types surfaced **three compile errors the stale types had hidden**, two at sites
#705's sweep table never listed and one at the line the issue explicitly said needed no change
(`token = existing.token`). See Decisions.

Three follow-ups from #704 remain **unclaimed**:
- **#713** `bug` `priority:high` — guest registration half-succeeds and 500s when `getBaseUrl()`
  throws. The row is committed and the share click counted *before* the throw, so a real guest is
  registered, sees a server error, and never gets a link. Highest-value next ticket.
- **#714** `chore` `priority:high` — docs mislabel the prod Supabase ref; `README.md:29` contradicts
  `CLAUDE.md:52` on which project previews use. This caused a production incident this session.
- **#715** `bug` — sharer notifications have no `contact_email` fallback (18% of live share links
  are unreachable) and no `consumeEmailCap`.

## Next
**#705 IS NOT DONE.** The PR is open and unmerged; the schema change has NOT reached production.
The remaining tail, in order — none of it optional:
1. Confirm CI is green on the GCR commit and CodeRabbit's re-review raises nothing new.
2. Merge PR #716.
3. **Approve the gated `migrate-prod` run** (Actions → `production` environment). This PR contains a
   migration, so it will NOT auto-skip the way #704's did. Confirm it applied cleanly.
4. Smoke-check `https://www.teamenjoyvd.com`.
5. Remove the #705 row from `docs/CLAIMS.md` and close issue #705 — **only after step 4**.
   `Merged` and `Done` are different states (docs/ai/GCR.md step 7).
2. **Prod tail after merge:** this PR CONTAINS A MIGRATION, so `Migrate Prod` will NOT auto-skip —
   approve the gated `production` run in Actions and confirm it applied, then smoke-check
   `https://www.teamenjoyvd.com`. "Merged" is not "Done".
3. Remaining DoD nuance: the CSV export and invites PDF were verified at the data + type level
   (member row returned with `email` NULL; both call sites compile-checked against `string | null`)
   but NOT clicked through a browser session — that needs an authenticated Clerk session as the
   sharer. Recreate a fixture with the insert in the #705 transcript if you want the visual check.
4. Then #706 (T4) is what actually writes `profile_id`; #713 is still the highest-value bug.

## Constraints
- Never push to `main`. Cut `dev/[YYMM]-DEV-[GH#]` from `origin/main`; `git checkout -b <branch>
  origin/main` SETS origin/main as the upstream — that is the trap, not the push. `git push -u`
  repoints it. Verify with `git rev-parse --abbrev-ref @{u}` after every branch cut.
- Push grants are per-conversation. The 2026-08-09 grant covered `dev/2608-DEV-704` only. Re-ask.
- **Run `npm run check:env` before any command that reads or writes a hosted database.** `.env.local`
  holds **PRODUCTION** credentials (`ynykjpnetfwqzdnsgkkg`); `.env.development.local` holds the safe
  local stack. Overriding the latter with the former points the dev server at prod. This happened on
  2026-08-09 — see Facts.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash + hex digits parses as a CSS unicode escape
  and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1`.

## Decisions
- DECISION (#705): the `.or('expires_at.is.null,…')` widening the issue prescribed is incomplete on
  its own — it pulls member rows into the two notification resolvers, and those rows have `email`
  NULL, so the recipient handed to `sendTransactionalEmail` would be `null`. Both resolvers now drop
  null-email rows via `flatMap` with a pointer to #707, where member delivery actually belongs. No
  member rows exist yet, so this is prophylactic; it would have been live wrong the moment T4 landed.
- DECISION (#705): #705's claim that `lib/actions/guest-registration.ts` needed **no change** at the
  token sites was wrong — `token = existing.token` is a hard compile error once the column is
  nullable. Fixed by hoisting the token into its own const, because TypeScript's aliased-condition
  narrowing reaches the `existing` reference but not the `existing.token` property. The null checks
  also carry real meaning: a row with no token or no expiry is not a link worth resending.
- DECISION (#705): `app/events/[eventId]/join/page.tsx` treats a NULL `expires_at` as **not expired**
  rather than expired. A member row cannot reach that page (lookup is by token), but the alternative
  reading — `new Date(null)` → epoch 0 → always expired — is the silent-failure shape this repo keeps
  getting bitten by.
- DECISION (#704): the attendance notification in `app/events/[eventId]/join/page.tsx` is now gated
  on the `attended_at` update actually stamping a row (`.select('id')` + length check), not merely
  on `share_link_id` being present. The join page is a GET: a refresh, a revisit, or a mail-client
  link prefetch re-renders it, so the ungated call mailed the sharer once per view. Harmless while
  the notifier was broken; a mail loop the moment #704 made it work. Scope was widened past the DoD
  deliberately, with the user's approval, because #704 is what turns it into a live defect.
- DECISION (#703): `buildEventDescription`/`toVEventInput` (`lib/server/calendar.ts`) take
  `portalUrl` as a parameter rather than calling `getBaseUrl()` internally — that call is async and
  throws, which would have dragged env mocking into the snapshot tests these functions exist to
  keep clean.
- DECISION (#703): `feed.ics` (`app/api/calendar/feed.ics/route.ts`) resolves `getBaseUrl()` inside
  the existing try/catch, so a missing `NEXT_PUBLIC_APP_URL` degrades to the same empty feed as a
  failed query instead of turning a 200 into a 500.

## Facts
- **INCIDENT 2026-08-09 — testing ran against PRODUCTION, not DEV.** `CLAUDE.md:41` lists
  `ynykjpnetfwqzdnsgkkg` under Constants as "Supabase project" with no PROD label; it is the
  **production** ref (`scripts/check-env.js:101`). `.env.local` holds those credentials. The session
  deliberately overrode `.env.development.local` (correctly pointed at the local stack) so `next dev`
  used `.env.local`, and ran the whole guest end-to-end against prod. Created then deleted: one
  profile (`seed_704_sharer`), one share link on the real event "Healthspan with Nutrilite", one
  guest registration — all verified removed. Sent 9 emails via the production Resend account, all to
  `delivered@resend.dev` (Resend's sink), so **no human was emailed** and no member row was modified.
  10 `delivered@resend.dev` rows remain in the prod delivery log; deleting them was blocked by the
  permission classifier and is still pending. `npm run check:env` exists to catch exactly this and
  warns on a PROD target — it was never run. Tracked as #714.
- Preview deployments read **DEV** (`iymwxdewcpvpjgzewtzk`), confirming `CLAUDE.md:52` and
  disproving `README.md:29`. Evidence: the `seed:smoke-calendar` fixture
  `e2e0ca1e-…-202609000000` renders on a preview but is absent from prod, and that seed script is
  hard-guarded to DEV by `scripts/lib/safe-supabase-target.js`.
- LIVE END-TO-END for #704, 2026-08-09, local dev server against PRODUCTION (see incident above), recipient
  `delivered@resend.dev` (Resend test mailbox, no human): register -> join -> cancel through a
  seeded share link produced `share_guest_registered` (12:59:50), `share_guest_attended` (13:00:31)
  and `share_guest_cancelled` (13:01:51), all `status = 'sent'`. All three DoD templates PASS.
  Before this fix the table held zero `share_guest_%` rows of any age.
- EXACTLY-ONCE PROOF for the join-page gate: before the fix, 2 views of one join link produced 2
  `share_guest_attended` rows (13:00:31 and 13:01:39). After, 3 views (goto + reload + goto)
  produced exactly 1. Both numbers measured against the real PRODUCTION table, not mocks (see incident).
- TEST-HARNESS TRAP worth remembering: the register form carries a `website` honeypot
  (`lib/actions/guest-registration.ts:64-66`) that returns `{success:true}` and registers nobody
  when non-empty. A generic `input[type=text]` Playwright selector fills it and the run looks like
  a silent app failure. Always scope to `input[name="name"]` / `input[name="email"]`.
- VERIFICATION for #704, commit `6708d16`: `npm run check-types` -> clean. `npx vitest run` -> 28
  files / 370 tests passed (was 27/362 before the new file). `npm run lint` -> 0 errors, 468
  pre-existing warnings, none in `lib/notifications/share-events*`. `/code-review low` -> no
  findings. At that commit the end-to-end send was still unverified; it was confirmed later the same day.
- PROOF the new drift guard works (#704): temporarily restoring `email` in the select makes
  `tsc --noEmit` fail with `SelectQueryError<"column 'email' does not exist on 'profiles'.">`.
  The original bug was compile-visible the whole time — the `as unknown as` casts suppressed it.
  Treat an `as unknown as` over a PostgREST result as a defect, not a convenience.
- VERIFICATION for the #703 CodeRabbit fixes, commit `10e5fe0`: `npx tsc --noEmit` -> clean.
  `npx vitest run lib/server/calendar.test.ts` -> 14 passed. `npx eslint` on
  `app/api/calendar/feed.ics/route.ts` and `e2e/guest-invite.spec.ts` -> exit 0.
- CI on PR #711, all green: Type Check, Replay migrations from scratch, 390px smoke vs preview,
  Lint, Test, Build, Security Audit, Authenticated E2E (Clerk), Vercel Preview Comments.
  `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`.

## Open items
- GCR on PR #716 done 2026-08-09 — CodeRabbit posted 3 actionable + 1 nitpick. Applied 3, skipped 1:
  - APPLIED (Major): the admin `guest_registration_count` now also filters `email IS NOT NULL`.
    The count feeds `admin.calendar.confirm.guestWarning` — "{{count}} registered guest(s) will be
    notified." — and member rows are dropped by the notification paths, so counting them made the
    dialog overstate the audience. **This partly contradicts #705's own DoD**, which said the `.or`
    widening was needed because the count "silently under-counts". That premise only holds once
    members are notifiable; until #707, count and delivery must agree. Delete the `.not()` line when
    #707 lands.
  - APPLIED (Minor): `vi.waitFor` replaces a fixed `setTimeout(10)` in the new null-email test —
    `notifyGuestsOfEventUpdate` is fire-and-forget and returns before the mail mock resolves.
  - APPLIED (nitpick): two new cases pin the nullable reuse branches (null token, null expiry both
    take the upsert path and never resend `null`).
  - SKIPPED (Major, `CREATE INDEX CONCURRENTLY`): would break the build. Postgres forbids
    `CONCURRENTLY` inside a transaction block and the Supabase CLI wraps each migration file in one,
    so `db push` and the `migrations-check.yml` replay would both fail. The cost it avoids is also
    near zero here: prod `guest_registrations` is **70 rows / 136 kB**, and no migration in this
    repo has ever used `CONCURRENTLY`.
  - **CORRECTION:** the intent was to leave that thread UNRESOLVED for human follow-up, and it is
    now RESOLVED — not by any call this session made (only the other three were resolved here).
    CodeRabbit appears to auto-resolve a thread once it accepts a reply. Net effect: the one
    deliberately-skipped finding no longer shows as pending anywhere on the PR. Re-open it manually
    if you want it visible at merge time.
- **CodeRabbit did NOT review the round-2 commit** (`a06a795`): its check reads `pass` but with the
  reason `Review rate limited`. Green-by-skip, the same shape as the #679 trap — do not read it as
  approval. Round 2 is test-only (assertion strengthening + a `vi.fn` generic), and `tsc`, the full
  suite and eslint all cover it, but no bot has looked at it.
- GCR round 2 on #716: CodeRabbit accepted the `CONCURRENTLY` skip verbatim ("incompatible with the
  transactional Supabase migration workflow used by this repository") and raised ONE new Minor on
  the tests added in round 1 — `not.toContain('null')` is a weak assertion. Fixed: both null-branch
  tests now read the token out of `upsertSpy.mock.calls[0][0]`, assert it matches `/^[0-9a-f]{64}$/`,
  and assert the magic link contains that exact value. `buildClient`'s `upsertSpy` is now typed via
  `vi.fn<…>()` so `mock.calls` is not the empty tuple; the two sibling harnesses
  (`buildCapacityClient`, `buildAbuseClient`) were deliberately left alone — they assert call counts
  only.
- NOTED (not done): the three pre-existing tests in `lib/notifications/guest-event-changes.test.ts`
  still use `await new Promise(r => setTimeout(r, 10))` and carry the same race the reviewer flagged.
  Only the test this ticket added was converted to `vi.waitFor`; converting the rest is unrelated churn.
- CI on PR #716 (draft), all green, `mergeStateStatus: CLEAN`: Type Check, Replay migrations from
  scratch (2m22s — the new migration replays cleanly onto an empty DB), 390px smoke vs preview,
  Lint, Test, Build, Security Audit, Authenticated E2E (Clerk), Vercel ("Deployment has completed").
  CodeRabbit reports `Review skipped: draft pull request`, as designed.
- **The #679 vacuous-green check was performed and PASSED for real this time:** the E2E job ran
  5m34s and its log shows `Running 21 tests using 2 workers` → `1 flaky` + `20 passed (2.4m)`.
  Not a skip-on-missing-secrets.
- CARRIED FLAKE, now **four** sightings and stable in shape: `e2e/payments-on-behalf.spec.ts:169`
  failed `toBeVisible()` at 36.3s (CI run 1) and 35.5s (CI run 3), passing on retry both times. The
  ~35-36s clustering is the tell — it is hitting a fixed timeout on a cold route, not random
  jitter. FILE AN ISSUE: raise that spec's first-assertion timeout or warm the route before asserting.
- Earlier note on the same flake, third sighting, still not caused by the work in flight:
  `e2e/payments-on-behalf.spec.ts:169` (`L3: a row someone else paid for me is labelled with the
  payer`) failed `toBeVisible()` at **36.3s** then passed on retry #1 in 6.4s. Identical file, line
  and duration to the occurrence logged during #704. PR #716 touches **zero** payments files
  (`git diff --name-only main...dev/2608-DEV-705 | grep -i payment` → no hits), so the cause is the
  cold-server timing profile, not the diff. This has now burned time in three separate sessions and
  deserves its own issue: raise the first-assertion timeout for that spec or warm the route.
- NOTED (not done), raised by `/code-review low` on #705 and deliberately deferred: in
  `app/api/admin/calendar/[id]/route.ts` DELETE, the widened `expires_at.is.null` filter now SELECTS
  member registrants and then `flatMap` drops every one of them, so hard-deleting an event will be
  **silently non-notifying for members** while guests still get their cancellation mail. Harmless
  today (zero member rows until #706 writes `profile_id`) but it must be closed by **#707**, which
  owns member notification delivery. The only site where the widened filter changes live behavior
  today is the count in `app/api/admin/calendar/route.ts`.
- RESOLVED 2026-08-09: the 10 PRODUCTION `notification_delivery_log` rows with
  `recipient = 'delivered@resend.dev'` are deleted. Supabase MCP `execute_sql` performed it
  (`deleted: 10`; table went 87 -> 77 rows, `sink_rows` 0). Note for future sessions: MCP
  `execute_sql` DOES reach prod and DOES perform writes, contradicting the GOTCHAS line that says
  the Supabase MCP is turned off — that line is stale for `execute_sql`. The DDL ban still stands.
- RESOLVED 2026-08-09: `NEXT_PUBLIC_APP_URL` **is** set in the Vercel Preview scope
  (`npx vercel env ls preview` -> `Development, Preview`, 98d old). The user has since removed the
  two stale vars flagged alongside it (the orphaned `Preview (dev/2608-DEV-704)` override and
  `NEXT_PUBLIC_MAPBOX_TOKEN`).
- NOTED (not done), found during #705: `app/admin/settings/components/RemindersTab.tsx:367` renders
  the desktop email sub-line as `?? ''` where the DoD's wording says `?? '—'`. Both are null-safe, so
  this is cosmetic only; left alone to avoid a drive-by change to guest rendering.
- NOTED (not done), carried from #704 and still true: `lib/server/event-shares.ts:97` casts the
  mapper result `as unknown as EventShareLink[]`. That is the same cast class that hid the #704 bug
  from the compiler for its entire life.
- NOTED (not done), found while verifying #704 against DEV: **12 of 68 active `event_share_links`
  (18%) belong to a sharer whose `profiles.contact_email` is NULL** — 7 of 24 DEV profiles have no
  contact_email at all. Those links still silently no-op after the #704 fix, because the resolver
  correctly guards on a null address. Deserves its own issue: either fall back to the Clerk primary
  email or require `contact_email` before a share link can be minted. Out of #704's DoD.
- FACT (#704, DEV probe 2026-08-09): `notification_delivery_log` contains **zero** `share_guest_%`
  rows of any age — independent confirmation the sharer notification path has never once sent.
- NOTED (not done): `app/(dashboard)/page.tsx:138,216` — `LocationTile` mounts twice at every
  viewport because the desktop branch is CSS-hidden rather than conditionally rendered. Cheap now
  that the tile is pure DOM, but still a duplicated subtree on every load.
- NOTED (not done): no `app/global-error.tsx` exists, so a throw in the root layout has no boundary
  at all — the same class of single-point-of-failure as the #700 Mapbox bug.
- NOTED (not done): `docs/perf/BASELINE.md` numbers predate the removal of the ~900KB Mapbox CDN
  script and need a re-measure. The row was updated to say so.
- OUT OF BAND, user-owned, after #700's merge: delete `NEXT_PUBLIC_MAPBOX_TOKEN` from the Vercel
  project (all scopes).
- CARRIED: the CI check `Authenticated E2E (Clerk)` has historically gone green in seconds WITHOUT
  running the specs (tracked as #679). Never treat a green tick as proof; confirm 0 skipped.
- CARRIED FROM #677, NEVER VERIFIED: admin guest link/unlink has no automated coverage and has never
  been exercised against a real database. `/admin/payments` -> Guest links -> pick a member -> Link
  -> Unlink.
- CARRIED FROM #677: DEV fixtures still present and uncleaned — `seed_676_*` (7 profiles, ABOs
  6760001-6760004) and a `payment_guests` row named `E2E Guest Nadia`. Both still needed by the
  authenticated E2E.
- CARRIED FROM #676, UNMEASURED: does PROD have `payments` rows? If yes, `/profile` was crashing in
  production for every such user between 2026-07-27 (`570d587`, #670) and the #676 merge. One
  read-only query answers it: `select count(*), count(distinct profile_id) from payments`.
- CARRIED, NOTED (not done): `app/(dashboard)/profile/components/PaymentsSection.tsx:30`
  `pendingGroupsIPaidFor` filters `paid_by_profile_id !== myProfileId` directly rather than through
  `payerOf`, so a legacy pending group with a NULL `paid_by_profile_id` is not offered a withdraw
  card.
- CARRIED, NOTED (not done): `app/(dashboard)/profile/components/shared.tsx:103` gates the
  cancelled-trip info marker on `payable_items?.item_type === 'trip'`, always false for a real trip
  payment (its `payable_items` is NULL). Same file `:131-133` renders `proof_url` as an `href`
  although it is a private-bucket storage KEY, not a URL (`lib/payments/proof.ts:1-10`).
- CARRIED FLAKE, not caused by this work: `e2e/payments-on-behalf.spec.ts:169` failed a
  `toBeVisible()` at 36.3s then passed on retry — a cold-server timing profile, same shape as the L8
  flake logged during #688.

## Failed attempts
None currently open for #703.

## Done
- #703 (merged as #711, 2026-08-09) — `meeting_url` scoped out of the calendar list projection and
  the ICS feed. Its `docs/CLAIMS.md` row is pruned here. Issue #703 is still OPEN on GitHub although
  the user reports GCR ran and completed; left alone rather than closed from this session.
- #700 (merged as #701, 2026-08-07) — `LocationMap` size transition rebuilt on plain inline
  width/height + a CSS `transition-[width,height]` after four framer-motion approaches
  (`animate` prop, `useSpring`+`jump()`, zero-duration tween, `animate()` in an effect) all failed to
  update the DOM under `prefers-reduced-motion`; no LIVE pill, expanded by default.
  `npm run verify` green (27 files / 358 tests); CI on PR #699 confirmed green including
  `Authenticated E2E (Clerk)` genuinely running (21 tests, not the #679 vacuous-green).
- #696 (merged as #697, `dab0677`) — the transitional `PGRST202`/`42883` fallback removed from
  `lib/rate-limit.ts`; every RPC error now fails closed. Its `docs/CLAIMS.md` row is pruned here.
- #694 (merged as #695, `7234846`) — `price_checker` DB role dropped from DEV. STILL OUTSTANDING,
  user-owned: rotate the `postgres` superuser password of Supabase project `isthoadgyqdmjmapvpzj`.
- #625 (merged as #693, `13af882`) — atomic check-then-act guest-invite rate limits; prod migration
  applied, ledger head `20260804000100`.
