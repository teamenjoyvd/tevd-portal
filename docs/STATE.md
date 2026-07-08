## Goal
Execute GitHub Milestone #2 "Security & Health Audit — 2026-07" (https://github.com/teamenjoyvd/tevd-portal/milestone/2): work through 24 open issues from the 2026-07-07 security/schema/architecture audit, critical fixes first. Includes a completed sub-task: a Sonnet/max-effort code-review pass over all 11 PRs open as of 2026-07-08, run as an alternative to CodeRabbit's quota-limited free-tier reviews.

## Now
Phase 1 critical fixes: #498, #499, #500, #501 MERGED to main; #502 still open (review-clean, awaiting merge). Phase 2 (#504), Phase 3 (#505, #506), Phase 5 architecture/lint (#507, #508) all open — each review-clean or fixed per the 2026-07-08 code-review pass (see Done log). #503 (this file's prior tracker snapshot) MERGED. Remaining open, milestone-relevant: #502, #504, #505, #506, #507, #508. Also open but not milestone-tracked: #509 (design-sync chore), #512 (this file's current tracking PR). Next up when resumed: #485 (only remaining Phase 3 item without a PR), then Phase 4.

## Next
- Merge the 6 remaining reviewed PRs (#502, #504, #505, #506, #507, #508) — all review-clean or fixed, awaiting human/CI merge
- #485 (Phase 3, not started): social-posts preview endpoint auth-only check + SSRF via caller-supplied URL
- Phase 4 — Low/correctness bugs (not started): #490 (/api/home dead+broken), #492 (phantom endpoints), #489 (22 unindexed FKs), #487 (inconsistent authz patterns), #488 (CI npm audit soft-gated)
- Phase 5 — Cleanup backlog remainder (not started): #469/#486/#491/#493/#494/#495 (dead code), #496 (file decomposition), #497 (tiptap bundle bloat)
- Issue #510 (guest-tier storage-policy bypass, filed 2026-07-08 during the #504 review) needs its own pickup — not part of the original 24-issue milestone list
- Each ticket runs its own SSU->PLAN->CLAIM->BUILD cycle on branch `dev/2607-DEV-[#]`

## Constraints
- User (this turn, re: #504 finding): "note + file follow-up, don't touch #504."
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
