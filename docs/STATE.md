## Goal
#547 local Supabase dev environment (2026-07-12, worktree `issue-547-4055aa`, user-driven guided setup): Docker local stack, `.env.development.local` off prod, seed data, buckets, DEV_WORKFLOW fence replacement. DoD: `supabase start` + `db reset` succeed on full migration chain; `npm run dev` renders seeded data; no prod service-role creds for day-to-day dev.
(PARKED: Milestone #2 "Security & Health Audit — 2026-07" — snapshot under Open items/Facts.)

## Now
Local stack UP and verified: all containers healthy; REST probe `GET /rest/v1/trips` → HTTP 200 with seeded trip (via real local demo keys from `supabase status`). Seed.sql has 4 profiles + 1 trip + 7 private buckets + role grants. `.env.development.local` written with real local keys. `npm ci` running in worktree, then dev-server render test.

## Next
(user directive 2026-07-12: "Once done I want the prod DB mirrored so we can test with real data. Afterwards open a PR, GCR and merge when everything is green")
- `supabase db reset` iteration 3 running (chain repair: 18 baseline-folded no-ops + guards in 20260409190500/20260514000200/20260517000100/20260707120400/20260710_002)
- Mirror prod DATA into local stack (data-only dump of public schema; needs prod DB connection string from user — never `supabase link` to prod ref per #547 issue text; storage files won't transfer, only DB rows)
- Dev-server re-test + `npm run verify`
- PR on `dev/2607-DEV-547` (push authorized by the directive above), then GCR pass, merge when CI green + Vercel preview READY
- (Parked milestone queue) merge-pending PRs #502/#504/#505/#506/#507/#508; #485; Phase 4: #490/#492/#489/#487/#488; Phase 5: #469/#486/#491/#493/#494/#495/#496/#497; #510 pickup

## Constraints
- Infra refactor (2026-07-11, user decisions via plan questions): keep prod DB in `.env.local` for now; archive stale docs, don't delete ("Move all five into docs/archive/, update README and look for other stale files to move to that same location"); split into two PRs; navigation-only local/preview testing until #547 lands
- User (prior task, re: #504 finding): "note + file follow-up, don't touch #504."
- Milestone touches Supabase RLS/grants/security-definer functions — Pattern A helpers only, never raw auth.jwt() (CLAUDE.md hard constraint)
- Never write data to Supabase from a Preview URL (preview hits prod DB)
- Never push directly to main; dev/[YYMM]-DEV-[GH#] branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- CLAUDE.md hard stop: no `git push` without the user explicitly asking for a push in-conversation (quote required)
- Hard stop: no failing check gets weakened/skipped to pass

## Decisions
DECISION: severity ordering (critical->high->medium->low->cleanup) inferred from issue content since milestone description's "4/2/3/5" split doesn't match current label set — mapped by reading each title, not by label alone.
DECISION: Phase 1 critical issues get one branch/PR each rather than bundled, because they touch RLS/grants/SECURITY DEFINER and need isolated review per hard constraints.
DECISION: 2026-07-08 review-pass push cadence = auto-push per PR for non-security PRs; always pause for go-ahead before pushing on the security-sensitive bucket — user answered both via AskUserQuestion.
DECISION: reclassified #506 (search_path pinning) into that pass's security-sensitive/pause bucket — same class of issue as #499-502/#504.

## Facts
- Local Supabase (issue #547): API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres, Studio :54323; keys = standard CLI demo JWTs from `supabase status`
- Migration-chain replay findings (2026-07-12): baseline `20260315000000` is a full prod snapshot dated 2026-04-07 that ALREADY CONTAINS the changes of migrations 20260319–20260407000001 (request_type, upline_abo_number, guides rename, social_posts, meeting_url…) → fresh replay conflicts. Schema drift: `public.settings` (ref'd by 20260514000200) and `public.email_log` (ref'd by 20260517000100) exist in prod but in NO migration. Also: 20260409190500 unschedules a nonexistent cron job; 20260424000001 hits "cannot change return type of existing function". Running local DB = baseline + seed only.
- psql not on host; use `docker exec supabase_db_iymwxdewcpvpjgzewtzk psql -U postgres -d postgres -c "..."`
- Buckets app expects (7): trip-hero-images, guide-covers, guide-images, guide-attachments, trip-proofs, trip-attachments, social-thumbnails
- Milestone #2 = "Security & Health Audit — 2026-07", 24 open issues originally
- Supabase project: ynykjpnetfwqzdnsgkkg
- Currently open, milestone-relevant PRs (`gh pr list`, 2026-07-08): #502 (issue #479), #504 (#480), #505 (#484), #506 (#481), #507 (#483), #508 (#482) — all CI-green/mergeable, all review-clean or fixed per the 2026-07-08 pass
- Merged since milestone start: #498 (#476), #499 (#477), #500 (#475), #501 (#478), #503 (this file's own prior tracker snapshot)
- Open but not milestone-tracked: #509 (design-sync chore), #512 (this file's current tracking PR)
- Security/RLS-sensitive subset from the 2026-07-08 review pass (pause-before-push bucket): #499, #500, #501, #502, #504, #506
- Pattern B RLS remediation (SEQ261-265, ADR-011) question resolved: #499-502/#506 confirmed to already use Pattern-A helpers correctly, not Pattern B

## Done
Milestone plan built — RESULT: 24 issues fetched and grouped into 5 phases by severity. Evidence: gh api output in original planning session.
First 5 priority tickets shipped — RESULT: #498/#499/#500/#501 MERGED to main; #502 still open (review-clean, awaiting merge).
Phase 2/3/5 shipped as PRs — RESULT: #504, #505, #506, #507, #508 all opened, all review-clean or fixed per the 2026-07-08 pass, awaiting merge.
2026-07-08 batch code-review pass (11 PRs open at the time) — RESULT: #507/#509/#505 clean (sub-80 notes only, comments posted, no fix). #508 — 1 real finding (confidence 82: desktop SocialsTile thumbnail regression), fixed + verified + committed (`cb4f1ff`) + pushed + commented. #503 — 2 real findings (confidence 92, 85: stale Now/Next claiming #480-484 "not started" and all-Phase-1-unmerged when #498 had already merged) — corrected + committed (`2ae3b88`) + pushed + commented, later merged as-is. #500/#501/#499/#506/#502 — zero real findings each (informational sub-80 notes only), commented, no fixes needed. #504 — one real but non-blocking finding: a pre-existing (not this PR's) storage.objects RLS policy allows anon-key bypass of the new signed-URL route for any `'guest'`-tier guide; verified live, zero guides currently use that tier so no live exposure today. Per user's choice, noted in the PR comment and filed as issue #510 rather than fixed in #504 itself — 5 of the 6 security-bucket PRs were clean, #504 was the one with a (non-blocking, deferred) finding.
PR #502 Gemini-review follow-up — RESULT: a concurrent session independently applied the `FOR ROLE postgres` hardening Gemini suggested (commit `8f781a7`); verified correct, not duplicated.

## Open items
- Issue #510 (guest-tier storage.objects RLS bypass on guide-attachments) — not yet fixed, needs its own PR
- 6 PRs (#502, #504, #505, #506, #507, #508) need CI green + Vercel preview READY + human merge before considered fully done
- Prior-task open item carried forward: REF.md phantom-route doc fix (`/api/events/[id]/register`) still not done, unrelated to this task
- Milestone remainder genuinely not started: #485 (Phase 3), #490/#492/#489/#487/#488 (Phase 4), #469/#486/#491/#493/#494/#495/#496/#497 (Phase 5 cleanup backlog)

## Failed attempts
(none)
