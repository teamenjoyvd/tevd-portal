## Goal
LOS import redesign (2026-07-13, worktree `refactoring-infra-bottlenecks-ca1053`): let CORE members upload their part of the LOS from a new `/profile/los-upload` page. Uploads stage as `pending` submissions (new `los_submission_requests` table) for admin review — no direct `los_members` write. Admin reviews in approval-hub, merges pending parts (deepest-owner-wins per ABO), then runs the existing `import_los_members` RPC. Scope guard: submission tree root must equal caller's `profiles.abo_number` (enforced server-side). CORE cannot purge or roll back others. Plan: `~/.claude/plans/redesign-of-the-los-wondrous-rain.md`.

## Now
ALL CODE COMPLETE + fully verified (static AND runtime). `npm run build` green; unit tests 96/96; eslint 0 errors.
**Runtime E2E: 6/6 pass** against hosted DEV (`e2e/los-submission-auth.spec.ts`, authenticated Playwright): scope-mismatch→400, matching-root→pending, withdraw, admin approve→import writes `los_members` + `last_updated_by_abo` (NEW=CORE self, CHILD=CORE upline), senior-CORE import stamps CHILD=SENIOR (upline), reject. Fixtures throwaway (ABOs 99000xx + e2e-core/senior users) seeded + cleaned up (verified 0 leftover). Existing `admin-auth` spec still 4/4 (no regression).
Migrations `20260713000000` + `20260713000100` applied to DEV + recorded via `migration repair --status applied`. Types spliced additively.
Env: worktree `.env.development.local` points at hosted DEV (keys pulled from Management API); `.env.local` supplies Clerk test keys. playwright.config.ts now loads env + includes the new spec in the authenticated project.

## Next
- Move to `dev/[YYMM]-DEV-[GH#]` branch; open PR; CI green + Vercel preview READY before Done
- Pre-existing DEV history drift (phantom 20260707/09/10 from #563) left untouched — reconcile with `migration repair --status reverted 20260707 20260709 20260710` when convenient (not mine)
- `.env*` are gitignored (do not commit); the worktree DEV keys live only locally
- (Parked, unrelated — #563 done, PR not opened; older milestone thread pointer, re-verify before acting): #502/#504/#505/#506/#507/#508 PRs, #510 storage RLS, milestone remainder #485/#490.. — pointers, not current fact.

## Constraints
- Never link/push the prod Supabase ref (`ynykjpnetfwqzdnsgkkg`) from a dev machine
- `.env.development.local` never committed (gitignored, real DEV-project credentials)
- Docker teardown (`docker system prune`) is user-run only, never scripted/automated
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- CLAUDE.md hard stop: no `git push` without the user explicitly asking for a push in-conversation (quote required)
- Hard stop: no failing check gets weakened/skipped to pass

## Decisions
DECISION: widened `scripts/seed-clerk-test-users.js`'s safety guard to accept the DEV project ref in addition to localhost, rather than leaving the authenticated E2E workflow dependent on the local Docker stack — user explicitly flagged that dependency as exactly what #563 exists to eliminate.
DECISION: CI's `e2e-authenticated` job keeps using a fresh local Supabase stack in the runner (isolated per run, avoids cross-run pollution of the shared DEV project) — this is a deliberate CI-isolation choice, not a "leftover" of the old local-first workflow, and was left unchanged.
DECISION: fixed the `docs/CLAIMS.md`/CLAUDE.md contradiction ("CLAIM does no file writes" vs. the CLAIM-Complete Definition requiring a CLAIMS.md row) by carving out an explicit single-file exception rather than picking a side silently.

## Facts
- Hosted DEV Supabase project: `iymwxdewcpvpjgzewtzk` (`tevd-portal-dev`), prod: `ynykjpnetfwqzdnsgkkg`
- Gotcha discovered + documented (`docs/ai/GOTCHAS.md`): `supabase db push`/`reset --linked` on a fresh Cloud project can fail on `uuid_generate_v4()` because `SET SESSION ROLE` mid-session doesn't inherit that role's configured `search_path`; fix is `ALTER DATABASE postgres SET search_path TO "$user", public, extensions;` once per project
- Seed data on DEV project: 4 role profiles + 1 sample trip + 7 storage buckets + 2 E2E Clerk test profiles (`user_3GPgzTRoaVUqpOTUIHSIC3mHXWg` member, `user_3GPgzcSz55oxqpEY1FHQAYkg0vC` admin)
- `npm run verify` (lint/check-types/test/build) green as of commit `5a9caa4`

## Done
Migration chain synced to DEV project — RESULT: 18 pending migrations pushed via `supabase db push`, verified via `supabase migration list` (all rows match).
Recovered a live incident — RESULT: `supabase db reset --linked` wiped the DEV project's `public` schema then failed on `baseline.sql`; diagnosed the `SET SESSION ROLE` search_path gap, fixed via `ALTER DATABASE`, full `db push` replay recovered schema + reseeded successfully (verified via REST before/after).
`check:env`/`setup-worktree-env.js`/`seed-clerk-test-users.js`/docs updated and committed — RESULT: 3 commits (`d522537`, `5a9caa4`, plus `b1ff228` for the CLAIMS.md/procedure fix), `npm run verify` green, `npm run dev` confirmed rendering DEV-project seed data in-browser.

## Open items
(none for #563 — implementation complete, PR not yet opened)

## Failed attempts
(none — the `db reset --linked` incident above was diagnosed and recovered in the same session, not abandoned)
