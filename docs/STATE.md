## Goal
#563 hosted Supabase dev project (2026-07-13, worktree `issues-485-490-5c096d`, branch `dev/2607-DEV-563`): replace the local Docker Supabase stack (#547) as the day-to-day local dev DB target with the hosted dev project `iymwxdewcpvpjgzewtzk`. App code needs zero changes — only env values, `check:env` classifier, worktree setup script, `seed-clerk-test-users.js` guard, and docs.

## Now
Implementation complete and verified (3 commits on `dev/2607-DEV-563`). Ready to push and open the PR.

## Next
- Push `dev/2607-DEV-563`, open PR (`Closes #563`), run GCR pass, merge when CI green + Vercel preview READY
- User-run only (destructive, not scripted): `supabase stop` + `docker system prune -a --volumes` to reclaim local disk once the DEV-project workflow is confirmed working day-to-day
- (Parked, unrelated milestone thread — last touched 2026-07-08, different worktree `issue-547-4055aa`, not part of this session): 6 PRs (#502/#504/#505/#506/#507/#508) awaiting CI green + Vercel preview + human merge; issue #510 (guest-tier storage.objects RLS bypass) not yet fixed; milestone remainder not started: #485, #490/#492/#489/#487/#488, #469/#486/#491/#493/#494/#495/#496/#497, #510 pickup. Whoever resumes that thread should re-verify current PR/issue state before acting — this line is a pointer, not current fact.

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
