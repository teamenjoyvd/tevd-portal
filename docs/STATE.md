## Goal
BUILD issue #703 (2608-DEV-703, branch `dev/2608-DEV-703`), first child of epic #702: stop shipping
`calendar_events.meeting_url` in the role-scoped calendar list projection and the ICS feed; point
both at the portal event page instead (epic decision D8).

## Now
PR #711 (`dev/2608-DEV-703`) is open and marked ready for review (not draft). CodeRabbit's one
review pass found 1 actionable comment (Major) + 1 nitpick; both applied in commit `10e5fe0`:
`app/api/calendar/feed.ics/route.ts` now hashes `portalUrl` into the ETag alongside `events`/
`calendarName`; `e2e/guest-invite.spec.ts`'s anonymous-payload test now seeds its own guest-visible
event (with `meeting_url` set) instead of skipping when the DB has none. The ETag review thread is
resolved. Pushed to `origin/dev/2608-DEV-703`. CI is all green and the PR is
`mergeStateStatus: CLEAN` / `mergeable: MERGEABLE`. Not yet merged.

## Next
1. Merge PR #711.
2. Post-merge tail (per `docs/ai/GCR.md` step 7): remove the `dev/2608-DEV-703` row from
   `docs/CLAIMS.md`; no migrations in this PR, so the prod-migration gate is skipped; smoke-check
   `https://www.teamenjoyvd.com`; close issue #703.

## Constraints
- Never push to `main`; `dev/2608-DEV-703` only. `git checkout -b dev/2608-DEV-703 origin/main` SET
  origin/main as the upstream; it was unset immediately (`git branch --unset-upstream`), so
  `git rev-parse --abbrev-ref @{u}` -> fatal and a bare `git push` cannot hit main. Re-check after
  every branch cut — the tracking default is the trap, not the push.
- `git push` to `dev/2608-DEV-703` was granted in conversation on 2026-08-09 ("push to PR so it's
  merge-ready") — used for commit `10e5fe0` and the `docs/STATE.md` prune commit. Re-ask for any
  push after this session ends.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row removal + `docs/STATE.md` updates into the merging PR — NEVER a
  standalone cleanup PR.
- Change only what the DoD requires; log other findings as `NOTED (not done): <thing> <file:line>`.
- Ask before editing `docs/guardrails/PROJECT.md`.
- NEVER paste an absolute Windows path into a tracked file. Tailwind v4 scans every source file
  (including .md) for utility candidates; a backslash + hex digits parses as a CSS unicode escape
  and kills `npm run build` with `Invalid code point <n>` pointed at `app/globals.css:1:1`.

## Decisions
- DECISION (#703): `buildEventDescription`/`toVEventInput` (`lib/server/calendar.ts`) take
  `portalUrl` as a parameter rather than calling `getBaseUrl()` internally — that call is async and
  throws, which would have dragged env mocking into the snapshot tests these functions exist to
  keep clean.
- DECISION (#703): `feed.ics` (`app/api/calendar/feed.ics/route.ts`) resolves `getBaseUrl()` inside
  the existing try/catch, so a missing `NEXT_PUBLIC_APP_URL` degrades to the same empty feed as a
  failed query instead of turning a 200 into a 500.

## Facts
- VERIFICATION for the #703 CodeRabbit fixes, commit `10e5fe0`: `npx tsc --noEmit` -> clean.
  `npx vitest run lib/server/calendar.test.ts` -> 14 passed. `npx eslint` on
  `app/api/calendar/feed.ics/route.ts` and `e2e/guest-invite.spec.ts` -> exit 0.
- CI on PR #711, all green: Type Check, Replay migrations from scratch, 390px smoke vs preview,
  Lint, Test, Build, Security Audit, Authenticated E2E (Clerk), Vercel Preview Comments.
  `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`.

## Open items
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
