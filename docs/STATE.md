## Goal
Execute GitHub Milestone #2 "Security & Health Audit — 2026-07" (https://github.com/teamenjoyvd/tevd-portal/milestone/2): work through 24 open issues from the 2026-07-07 read-only security/schema/architecture audit, critical security fixes first.

## Now
CORRECTED 2026-07-08 — this file was stale: it had not been updated since 2026-07-07 ~11:38 despite same-day work continuing. PR #498 (issue #476) has since MERGED to main (commit `56f0f0e`, 2026-07-07T12:19). Issues #480, #481, #482, #483, #484 have ALSO since shipped as open PRs (#504, #506, #508, #507, #505) — none of that was "not started" as this file previously claimed. 9 PRs (#499-#502, #504-#508) are open, CI-green, awaiting human merge. Next up when resumed: #485 (only remaining Phase 3 item without a PR), then Phase 4.

## Next
Open PRs awaiting merge (verify still-open with `gh pr list` before acting — this file drifts fast):
- Phase 1 critical: #499 (issue #477), #500 (#475), #501 (#478), #502 (#479)
- Phase 2: #504 (issue #480)
- Phase 3: #505 (issue #484), #506 (issue #481)
- Phase 5 architecture/lint: #507 (issue #483), #508 (issue #482)

Not yet started:
Phase 3 remainder:
9. #485 social-posts preview endpoint: auth-only check + SSRF via caller-supplied URL

Phase 4 — Low/correctness bugs:
10. #490 /api/home dead + broken (filters on nonexistent column)
11. #492 live code references endpoints that don't exist (404s)
12. #489 22 unindexed FKs on hot join/filter columns
13. #487 inconsistent authorization patterns across API routes
14. #488 CI npm audit soft-gated (|| true)

Phase 5 — Cleanup backlog remainder (candidates to bundle a few per PR):
Dead code/orphaned: #469, #486, #491, #493, #494, #495
Architecture/lint remainder: #496 (file decomposition), #497 (tiptap bundle bloat)

Each ticket runs its own SSU->PLAN->CLAIM->BUILD cycle on branch `dev/2607-DEV-[#]`. Phase 1 items get isolated PRs (RLS/grants, needs focused review). Phase 5 items may bundle a few independent dead-code removals per PR.

## Constraints
- Milestone touches Supabase RLS/grants/security-definer functions — Pattern A helpers only, never raw auth.jwt() (CLAUDE.md hard constraint)
- Never write data to Supabase from a Preview URL (preview hits prod DB)
- Never push directly to main; dev/[YYMM]-DEV-[GH#] branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green

## Decisions
DECISION: severity ordering (critical->high->medium->low->cleanup) inferred from issue content since milestone description's "4/2/3/5" split doesn't match current label set (23 audit issues + 1 pre-existing #469, more issues added after milestone creation) — mapped by reading each title, not by label alone.
DECISION: Phase 1 critical issues get one branch/PR each rather than bundled, because they touch RLS/grants/SECURITY DEFINER and need isolated review per hard constraints.

## Facts
- Milestone #2 = "Security & Health Audit — 2026-07", 24 open issues, 0 closed, no due date
- Full issue list pulled via `gh api repos/teamenjoyvd/tevd-portal/issues?milestone=2&state=all&per_page=100`
- No open PRs at session start (SSU check via `gh pr list`, 2026-07-07)
- Supabase project: ynykjpnetfwqzdnsgkkg

## Done
Milestone plan built — RESULT: 24 issues fetched and grouped into 5 phases by severity, persisted here for cross-session/cross-agent continuity. Evidence: gh api output in this session.
First 5 priority tickets shipped — RESULT: PR #498 (issue #476, MERGED to main 2026-07-07T12:19, commit `56f0f0e`), PR #499 (#477), PR #500 (#475), PR #501 (#478), PR #502 (#479). Each: CLAIM done (issue updated with Design Checklist + Branch), migration written + applied to prod via Supabase MCP `apply_migration`, grants verified via `has_function_privilege`/`has_table_privilege` post-apply, committed + pushed + PR opened with `Closes #<n>`. #499-#502 still awaiting CI/Vercel preview + human review as of this update.
Phase 2/3/5 acceleration (not reflected in this file's prior version) — RESULT: issues #480, #481, #482, #483, #484 also shipped as open PRs #504, #506, #508, #507, #505 respectively, same day, after this file's original 11:38 snapshot — still awaiting merge as of this update.

## Open items
- Manual, non-code follow-up required for #475: rotate the Google service-account key and `sync_secret` in Vault (this agent has no Google Cloud Console / Vault UI access) — flagged in PR #500 and issue #475.
- 9 PRs (#499-#502, #504-#508) need CI green + Vercel preview READY + human merge before considered fully done per CLAUDE.md hard constraint ("NEVER mark Done on static analysis alone"). #498 already merged.
- Milestone remainder genuinely not started: #485 (Phase 3), #490/#492/#489/#487/#488 (Phase 4), #469/#486/#491/#493/#494/#495/#496/#497 (Phase 5 cleanup backlog).

## Failed attempts
(none)
