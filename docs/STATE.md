## Goal
Local-dev full audit + repair (2026-07-12, worktree `dev-infrastructure-refactor-072890`, branch `claude/local-dev-audit-277243`): verify every dev command and the local Supabase stack, close the gap between docs and reality (#546/#547 both landed), and leave local dev 100% operational — dev targets the LOCAL stack, not prod.
(PARKED: Milestone #2 "Security & Health Audit — 2026-07" — snapshot under Open items/Facts.)

## Now
Audit complete, all fixes verified 2026-07-12: `npm run verify` → exit 0 (82/82 tests); dev server on Next 16.2.10 renders seeded local data (`Environments: .env.development.local, .env.local`); check:env → "LOCAL stack (127.0.0.1:54321)". Main checkout recovered: was parked on stale `dev/2607-DEV-design-sync` (pre-#546, EBADPLATFORM on npm ci) → stashed .agents edits (`stash@{0}`), checked out latest main, `npm ci` clean (613 packages). Worktree node_modules synced to lockfile (16.1.6 → 16.2.10).

## Next
- Ticket #563 shaped and filed (migrate dev DB to hosted dev project `iymwxdewcpvpjgzewtzk`, drop local Docker stack; supersedes the #547 local-stack workflow, reuses its env-override layer) — CLAIM/BUILD in a future session
- Streamlining wins implemented in this worktree: PROJECT.md SSU local fast path; validate-rules.js rollback warnings aggregated (114 → 3 total warnings)
- Changes are local-only in worktree `dev-infrastructure-refactor-072890` (no push authorized this session); user decides on PR (needs an issue + `dev/`-branch per convention)
- Clerk keys verified same-instance (loved-mole-75); "infinite redirect loop" log line is a stale-cookie heuristic, benign — clear browser cookies if sign-in ever misbehaves
- (Parked milestone queue) #485; Phase 4: #490/#492/#489/#487/#488; Phase 5: #469/#486/#491/#493/#494/#495/#496/#497; #510 pickup

## Constraints
- Dev-DB migration (2026-07-13, verbatim): "we need to migrate to the dev instance on supabase.com"; "everything else but the DB remains local" — ticket #563
- Local-dev audit (2026-07-12, verbatim): "where can we streamline to reduce token usage but preserve the functionality 100%"; "Final goal is to have a 100% fully operational local dev after this run"
- Infra refactor (2026-07-11, user decisions via plan questions): keep prod DB in `.env.local` for now; archive stale docs, don't delete ("Move all five into docs/archive/, update README and look for other stale files to move to that same location"); split into two PRs; navigation-only local/preview testing until #547 lands (#547 landed 2026-07-12 — expired)
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
- The 2026-07-08 PR batch (#502, #504, #505, #506, #507, #508) no longer appears in `gh pr list --state open` (2026-07-12: zero open PRs) — resolved
- Prior-task open item carried forward: REF.md phantom-route doc fix (`/api/events/[id]/register`) still not done, unrelated to this task
- Milestone remainder genuinely not started: #485 (Phase 3), #490/#492/#489/#487/#488 (Phase 4), #469/#486/#491/#493/#494/#495/#496/#497 (Phase 5 cleanup backlog)
- NOTED (not done): ~110 `agentic:validate` warnings — migrations missing `-- ROLLBACK:` comments (advisory); untracked June-orchestration leftovers in main checkout root (`.agents/` dirs, `convert.js`, `test_out.txt`) — user call whether to archive/delete; pre-existing April stash `stash@{1}` on main; guest-visitor console error `Query data cannot be undefined ["profile-ui-prefs-font-size"]` (pre-existing app behavior, app/…UI-prefs query returns undefined for signed-out users); Playwright `webServer.timeout` 120s < cold worktree compile ~5min (warm the cache first)

## Failed attempts
(none)
