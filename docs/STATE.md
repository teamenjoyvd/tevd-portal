## Goal
Agent-docs streamline (2026-07-12, plan-mode approved, worktree `infrastructure-inventory-4eb67c`): archive dead agent-doc surfaces (PROJECT-NOTES, MIGRATION-LOG, QA, GEMINI, CONTEXT → docs/archive/agent-docs-2026-07/), retire Antigravity multi-agent workflow + .cursor rules + agentic upstream sync (hash pinning removed, 5 kit scripts archived, agentic:validate kept), dedupe pointers (CLAUDE.md/AGENTS.md/README/DEV_WORKFLOW/DECISIONS), fix REF.md phantom route + add §12 CI, streamline system-prompt.xml preamble. BUILD/CLAIM/PLAN/GCR docs stay canonical (skills' doc-read behavior unverifiable). Plan: `~/.claude/plans/propose-a-plan-to-sharded-bear.md`. Status: all edits done, `npm run verify` running (after npm ci — worktree had no node_modules). NOT committed, NOT pushed. Needs a `dev/[YYMM]-DEV-[GH#]` branch + issue at PR time (currently on `claude/infrastructure-inventory-4eb67c`).
QA.md backlog items (roles-page history view, user-dropdown profile link): dropped as non-relevant per user 2026-07-12 — "they've actually already been implemented". No issues filed. NOTED: system-prompt.xml kept its instructional mode comments (load-bearing), 146→~127 lines vs plan's ~90 estimate.

(Previous goal, superseded 2026-07-12:)
Dev-infrastructure refactor (2026-07-11, plan-mode approved): supersede PR #544 (closed) with two PRs — #545 hygiene/knowledge-tracking (branch `dev/2607-DEV-545`) and #546 local verification tooling (branch `dev/2607-DEV-546`, stacked on 545) — plus #547 (local Supabase, priority:high, next ticket after these). Plan file: `~/.claude/plans/infrastructure-refactor-update-i-want-clever-sphinx.md`.
(PARKED, resume after: Milestone #2 "Security & Health Audit — 2026-07" — status snapshot preserved under Open items/Facts below.)

## Now
Both PRs built and verified locally, committed on their branches, NOT pushed (awaiting explicit user approval). PR A (#545, `dev/2607-DEV-545`): hygiene/docs/archive + eslint ignore retarget (.agents→docs/archive). PR B (#546, `dev/2607-DEV-546`, stacked on A): optionalDependencies fix for Windows EBADPLATFORM (from 4f27d7a) + ci.yml npm ci + verify/check:env/env:worktree scripts + Playwright mobile-390 smoke + preview-smoke.yml (advisory) + turbopack root + .claude/settings.json. Verified: `npm run verify` exit 0 (lint 0 errors / tsc / 82 tests / build 62 pages); `npm run test:mobile` 6/6 public routes green at 390px.

## Next
- User to approve push of `dev/2607-DEV-545` and `dev/2607-DEV-546`; open PRs (B based on A, retarget to main after A merges); confirm CI green + Vercel preview READY + preview-smoke run
- Findings logged during smoke (pre-existing, not fixed here): anonymous visitors get a 401 + "Query data cannot be undefined" console error from the `profile-ui-prefs-font-size` query; radix-id hydration mismatch on `/`
- Then: #547 local Supabase (priority:high)
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
