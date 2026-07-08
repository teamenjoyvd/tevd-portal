## Goal
Clear the open PR queue to merge-ready: run Sonnet Max `/code-review` on each open PR, apply high-confidence fixes, comment findings, resolve GitHub review threads for applied fixes, comment the reason for any rejected finding.

## Now
All 11 PRs reviewed and commented; goal complete. See Done log below for per-PR outcomes.

## Next
Nothing outstanding from this task. Possible future follow-ups (not started, not asked for):
- Issue #510 (guest-tier storage-policy bypass, filed this session) needs someone to actually pick it up
- The 11 PRs still need human merge — this task only got them review-clean, did not merge anything
- Optional: prune the scratch review worktrees under `.claude/worktrees/reverent-sammet-ff53c3/.claude/worktrees/review-{499,500,501,502,506}` (local-only, harmless if left)

## Constraints
- User (this turn): "Run Sonnet Max code review and do everything else necessary to bring the queue to a merge-ready state. Comment findings and resolve comments when applied, otherwise comment why rejected."
- CLAUDE.md hard stop: no `git push` without the user explicitly asking for a push in-conversation (quote required) — not yet satisfied, must ask before any push
- CLAUDE.md hard constraint: RLS policies use Pattern A helpers only (`is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`) — relevant to #499-502
- CLAUDE.md hard constraint: never mark Done on static analysis alone — Vercel preview READY + CI green required (already true for all 11 per `gh pr list`, re-verify per PR before calling it merge-ready)
- Hard stop: no failing check gets weakened/skipped to pass

## Decisions
DECISION: push cadence = auto-push per PR for non-security PRs; always pause for go-ahead before pushing on the security-sensitive bucket — user answered both via AskUserQuestion.
DECISION: reclassified #506 (pin search_path on 22 functions) into the security-sensitive/pause bucket — same class of issue (search_path-mutable privilege escalation) as #499-502/#504; I'd mis-scoped it out of the original question. ASSUMPTION, not re-asked, per evidence above.

## Facts
- 11 open PRs (`gh pr list`, all `mergeable=MERGEABLE`, all CI checks SUCCESS, `reviewDecision` empty on all):
  - #509 chore: design-sync inputs for components/ui Claude Design sync
  - #508 [2607-DEV-482] Collapse TripCard/SocialsTile dual-layout files into single responsive components
  - #507 [2607-DEV-483] Co-locate CalendarClient/GuidesClient with their single route
  - #506 [2607-DEV-481] Pin search_path on 22 functions flagged by function_search_path_mutable
  - #505 [2607-DEV-484] Add auth/payments/admin-mutation test coverage
  - #504 [2607-DEV-480] Make guide-attachments bucket private, disable listing on 4 public buckets
  - #503 docs: track milestone #2 security-audit progress in STATE.md (NOTE: modifies this same docs/STATE.md file, on its own branch — expect that diff shape, not an error)
  - #502 [2607-DEV-479] Restrict 24 SECURITY DEFINER functions to service_role, harden default privileges
  - #501 [2607-DEV-478] Revoke anon/authenticated SELECT on owner-privileged history views
  - #500 [2607-DEV-475] Revoke anon/authenticated EXECUTE on vault_read_secrets()
  - #499 [2607-DEV-477] Guard purge_absent_los_members()/rollback_los_import() against anonymous data destruction
- Security/RLS-sensitive subset (pause-before-push bucket): #499, #500, #501, #502, #504, #506 (all touch Supabase permissions/SECURITY DEFINER/RLS/search_path surface)
- Auto-push bucket: #503, #505, #507, #508, #509
- gh auth confirmed: logged in as teamenjoyvd, token scopes gist/read:org/repo
- Current worktree branch claude/reverent-sammet-ff53c3, tree clean, unrelated to the 11 PR branches
- Carried fact (unverified, from prior completed task): Pattern B RLS remediation (SEQ261-265, ADR-011) status unknown from docs alone — check whether #499-502 are that remediation
- Carried open item (prior task, not yet fixed): REF.md §4/§6 documents a phantom route `/api/events/[id]/register`; real implementation is `registerGuest()` server action — out of scope here, flagging so it isn't lost

## Done
Auto-push bucket (5 PRs) reviewed — RESULT: #507 clean (2 sub-80 notes, comment posted, no fix). #509 clean (1 sub-80 note, comment posted, no fix). #505 clean (3 sub-80 notes, comment posted, no fix). #508 — 1 real finding (confidence 82: desktop SocialsTile thumbnail regression from dual-layout merge), fixed + verified (check-types/build/lint match PR's own pre-existing-error baseline) + committed (`cb4f1ff`) + pushed + commented. #503 — 2 real findings (confidence 92, 85: stale Now/Next/Done claiming #480-484 "not started" when all already had open PRs #504-508, and all-5-Phase-1-unmerged when #498 already merged) — corrected content, committed (`2ae3b88`) + pushed + commented. CAUGHT OWN MISTAKE: first #503 comment cited a fabricated full SHA (typed from memory instead of verifying) — caught immediately, fixed via `gh pr comment --edit-last` before moving on. Lesson: always `git rev-parse HEAD` explicitly right before building a GitHub blob link, never pattern-complete a short SHA.
Security bucket (6 PRs, extra-caution/pause-before-push per user) reviewed — RESULT: all 6 came back clean at the ≥80 threshold — #500, #501, #499, #506, #502 had zero real findings (only informational sub-80 notes); commented each, no fixes needed so the pause-before-push cadence never actually triggered (nothing to push). #499's assigned worktree was found stale (2 commits behind PR tip, missed prior Gemini/CodeRabbit follow-up fixes) — caught via fetch/status check, fast-forwarded, re-verified guard clause unchanged across versions before commenting. #504 (bucket privacy + new signed-URL route, the one PR with real new app code) surfaced one genuine but non-blocking finding: a pre-existing (not this PR's) storage.objects RLS policy still allows anon-key bypass of the new route for any `'guest'`-tier guide — verified live, zero guides currently use that tier so no live exposure today. Asked user how to handle it; user chose "note + file follow-up, don't touch #504." Filed issue #510 with full mechanism + suggested fix, commented on #504 referencing it, no fix pushed to #504 itself.
Task complete — RESULT: 11/11 open PRs reviewed at Sonnet/max effort, each with a posted review comment; 2 real bugs found and fixed/pushed (#508, #503); 1 real-but-latent security gap found and tracked as a new issue (#510) rather than bundled; 0 PRs needed the security bucket's pause-before-push (nothing rose to a fixable finding there). No PRs were merged — that's a separate human/CI-gated step this task didn't do.

## Open items
- Issue #510 (guest-tier storage.objects RLS bypass on guide-attachments, filed this session) — not yet fixed, needs its own PR
- Prior-task open item carried forward: REF.md phantom-route doc fix (`/api/events/[id]/register`) still not done, unrelated to this task
- The "Pattern B RLS remediation (SEQ261-265, ADR-011) status unknown" item from before is effectively answered: #499-502/#506 were confirmed (via this session's reviews) to already use Pattern-A helpers correctly, not Pattern B

## Failed attempts
(none)
