## Goal
LOS import redesign (PR #569, 2026-07-13, branch `claude/los-import-redesign-a675c2`): let CORE members upload their part of the LOS from a new `/profile/los-upload` page. Uploads stage as `pending` submissions (new `los_submission_requests` table) for admin review — no direct `los_members` write. Admin reviews in approval-hub, merges pending parts (deepest-owner-wins per ABO), then runs the existing `import_los_members` RPC. Scope guard: submission tree root must equal caller's `profiles.abo_number` (enforced server-side). CORE cannot purge or roll back others. Plan: `~/.claude/plans/redesign-of-the-los-wondrous-rain.md`.

## Now
ALL CODE COMPLETE + fully verified (static AND runtime). `npm run build` green; unit tests 96/96; eslint 0 errors.
**Runtime E2E: 6/6 pass** against hosted DEV (`e2e/los-submission-auth.spec.ts`, authenticated Playwright): scope-mismatch→400, matching-root→pending, withdraw, admin approve→import writes `los_members` + `last_updated_by_abo` (NEW=CORE self, CHILD=CORE upline), senior-CORE import stamps CHILD=SENIOR (upline), reject. Fixtures throwaway (ABOs 99000xx + e2e-core/senior users) seeded + cleaned up (verified 0 leftover). Existing `admin-auth` spec still 4/4 (no regression).
Migrations `20260713000000` + `20260713000100` applied to DEV + recorded via `migration repair --status applied`. Types spliced additively.
Merged `origin/main` (post-#568) into the branch: the only conflict was this file — PR #569's session content kept, main's Constraints/Open-items superset preserved.

## Next
- CI green + Vercel preview READY before Done (PR #569)
- Pre-existing DEV history drift (phantom 20260707/09/10 from #563) left untouched — reconcile with `migration repair --status reverted 20260707 20260709 20260710` when convenient
- `.env*` are gitignored (do not commit); the worktree DEV keys live only locally
- `.env.development.local` on the dev machine should point at the hosted DEV project per docs/DEV_WORKFLOW.md "Hosted dev database"; local Docker stack teardown (`supabase stop` + `docker system prune -a --volumes`) is user-run only
- (Parked milestone queue) #510 storage RLS; #485; Phase 4: #490/#492/#489/#487/#488; Phase 5: #469/#486/#491/#493/#494/#495/#496/#497

## Constraints
- Dev-DB migration (2026-07-13, verbatim): "we need to migrate to the dev instance on supabase.com"; "everything else but the DB remains local" — shipped via #563/#564
- Local-dev audit (2026-07-12, verbatim): "where can we streamline to reduce token usage but preserve the functionality 100%"; "Final goal is to have a 100% fully operational local dev after this run"
- Infra refactor (2026-07-11, user decisions via plan questions): keep prod DB in `.env.local` for now; archive stale docs, don't delete; split into two PRs
- User (prior task, re: #504 finding): "note + file follow-up, don't touch #504."
- Never link/push the prod Supabase ref (`ynykjpnetfwqzdnsgkkg`) from a dev machine
- `.env.development.local` never committed (gitignored, real DEV-project credentials after the #563 switch)
- Docker teardown (`docker system prune`) is user-run only, never scripted/automated
- Milestone touches Supabase RLS/grants/security-definer functions — Pattern A helpers only, never raw auth.jwt() (CLAUDE.md hard constraint)
- Never write data to Supabase from a Preview URL (preview hits prod DB)
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- CLAUDE.md hard stop: no `git push` without the user explicitly asking for a push in-conversation (quote required)
- Hard stop: no failing check gets weakened/skipped to pass

## Decisions
DECISION: widened `scripts/seed-clerk-test-users.js`'s safety guard to accept the DEV project ref in addition to localhost, rather than leaving the authenticated E2E workflow dependent on the local Docker stack — user explicitly flagged that dependency as exactly what #563 exists to eliminate.
DECISION: CI's `e2e-authenticated` job keeps using a fresh local Supabase stack in the runner (isolated per run, avoids cross-run pollution of the shared DEV project) — this is a deliberate CI-isolation choice, not a "leftover" of the old local-first workflow, and was left unchanged.
DECISION: fixed the `docs/CLAIMS.md`/CLAUDE.md contradiction ("CLAIM does no file writes" vs. the CLAIM-Complete Definition requiring a CLAIMS.md row) by carving out an explicit single-file exception rather than picking a side silently.
DECISION: LOS authority model is deepest-owner-wins (closest upline owner of a contested ABO, ties broken by newest submission), replacing first-seen-wins — contested nodes surface as junctions instead of resolving silently.

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
- Issue #510 (guest-tier storage.objects RLS bypass on guide-attachments) — not yet fixed, needs its own PR
- Prior-task open item carried forward: REF.md phantom-route doc fix (`/api/events/[id]/register`) still not done, unrelated to this task
- Milestone remainder genuinely not started: #485 (Phase 3), #490/#492/#489/#487/#488 (Phase 4), #469/#486/#491/#493/#494/#495/#496/#497 (Phase 5 cleanup backlog)
- NOTED (not done): untracked June-orchestration leftovers in main checkout root (`.agents/` dirs, `convert.js`, `test_out.txt`) — user call whether to archive/delete; pre-existing April stash `stash@{1}` on main; guest-visitor console error `Query data cannot be undefined ["profile-ui-prefs-font-size"]` (pre-existing app behavior, UI-prefs query returns undefined for signed-out users); Playwright `webServer.timeout` 120s < cold worktree compile ~5min (warm the cache first)

## Failed attempts
(none — the `db reset --linked` incident above was diagnosed and recovered in the same session, not abandoned)
