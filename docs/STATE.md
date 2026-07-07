## Goal
Execute GitHub Milestone #2 "Security & Health Audit — 2026-07" (https://github.com/teamenjoyvd/tevd-portal/milestone/2): work through 24 open issues from the 2026-07-07 read-only security/schema/architecture audit, critical security fixes first.

## Now
First 5 priority tickets (goal set via /goal) all shipped as PRs, all applied directly to prod DB via Supabase MCP and verified. Awaiting CI/Vercel preview + human merge on all 5 PRs. Next up when resumed: #480 (Phase 2 remainder).

## Next
Phase 2 — High (1 remaining):
6. #480 Public storage buckets bypass role-gated access, allow anon listing

Phase 3 — Medium:
7. #484 zero automated test coverage on auth/payments/admin-mutation paths
8. #481 function_search_path_mutable on 22 functions incl. RLS helpers
9. #485 social-posts preview endpoint: auth-only check + SSRF via caller-supplied URL

Phase 4 — Low/correctness bugs:
10. #490 /api/home dead + broken (filters on nonexistent column)
11. #492 live code references endpoints that don't exist (404s)
12. #489 22 unindexed FKs on hot join/filter columns
13. #487 inconsistent authorization patterns across API routes
14. #488 CI npm audit soft-gated (|| true)

Phase 5 — Cleanup backlog (candidates to bundle a few per PR):
Dead code/orphaned: #469, #486, #491, #493, #494, #495
Architecture/lint: #482 (dual-layout bar), #483 (co-location), #496 (file decomposition), #497 (tiptap bundle bloat)

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
First 5 priority tickets shipped — RESULT: PR #498 (issue #476), PR #499 (#477), PR #500 (#475), PR #501 (#478), PR #502 (#479). Each: CLAIM done (issue updated with Design Checklist + Branch), migration written + applied to prod via Supabase MCP `apply_migration`, grants verified via `has_function_privilege`/`has_table_privilege` post-apply, committed + pushed + PR opened with `Closes #<n>`. None merged yet — awaiting CI/Vercel preview + human review.

## Open items
- Manual, non-code follow-up required for #475: rotate the Google service-account key and `sync_secret` in Vault (this agent has no Google Cloud Console / Vault UI access) — flagged in PR #500 and issue #475.
- 5 PRs (#498-#502) need CI green + Vercel preview READY + human merge before considered fully done per CLAUDE.md hard constraint ("NEVER mark Done on static analysis alone").
- Milestone Phase 2 remainder: #480 (public storage buckets bypass role-gated access) not started.
- Phases 3-5 (#484, #481, #485, then #490/#492/#489/#487/#488, then cleanup backlog) not started — see original phase breakdown in git history of this file if needed, or re-derive from milestone #2.

## Failed attempts
(none)
