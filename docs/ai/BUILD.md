# BUILD — Execution Mode

Default mode. Executes code changes against a CLAIM-completed issue.

## 1. Precondition

Read the issue body. Verify `## Design Checklist` exists with all four items checked AND `## Branch` exists with the branch name. If either is absent or any item unchecked — stop, state exactly what is missing, do not proceed.

## 2. Stages

### READ & SHAPE (Read-only)
- Find in-progress issues (open PRs) or CLAIM-completed issues. If none, pick the highest `priority:high` open issue without the `blocked` label.
- Verify the DoD is coherent with the current codebase. Rely on `CLAUDE.md` (hard constraints), `docs/guardrails/PROJECT.md` and project architecture docs:
  - Auth / role / Clerk sync → `FLOWS.md §1`
  - Registration → `FLOWS.md §2`
  - Payments → `FLOWS.md §3`
  - LOS / tree / notifications → `FLOWS.md §4`
  - Vital signs → `FLOWS.md §5`
  - New external dependency → update `C4.md` first
  - New architectural pattern → write ADR in `DECISIONS.md` before executing
- No codebase writes allowed during this stage.

### GATHER
Read only the specific `docs/ai/REF.md` sections required by the ticket (refer to the Section Map in `REF.md`).

### EXECUTE
- Code only what is required by the DoD. All changes target the feature branch only. Build and verify entirely locally against the hosted DEV Supabase project; migrations are applied and behavior-verified on the dev DB only.
- Every new migration file carries a `-- ROLLBACK:` comment — do not push without it.
- Before the first push: run `/code-review low` on the branch diff and fix findings locally (auth/RLS/migration changes: escalate to `/security-review` or `/code-review medium`).
- Push and open the PR **as a draft** to trigger CI and the Vercel Preview. CodeRabbit skips drafts (`.coderabbit.yaml`) — iterate freely while in draft.
- For large tasks (>100 lines), commit a skeleton with `// TODO:` items before implementing, and update the PR Session State to `IN PROGRESS`.

### VERIFY
- Verify DoD point-by-point.
- Check Vercel Preview is READY and CI is green. Green-by-skip does not count: confirm gated jobs (e.g. Authenticated E2E) actually executed their steps rather than skipping on missing secrets — inspect the job's steps, not just its conclusion.
- Ensure 390px mobile responsiveness.
- Ensure no production side-effects. If ticket touched auth or routing: confirm `middleware.ts` does not exist.

### FINALIZE
- Add `Closes #<issue_number>` to the PR body. Mark the PR as **ready for review** — this triggers the single CodeRabbit pass.
- Address all CodeRabbit findings locally and push them as ONE batched commit (each push triggers an incremental re-review; drip-fed fixes burn quota). Wrong findings: reply on the thread and resolve, don't churn code.
- Update the PR description's `## Session State` block.
- Update `docs/ai/REF.md` if schema, tables, routes, or env vars changed.
- After merge: confirm production Vercel deployment is READY, apply the dev-verified migration to prod, smoke-check the production URL, remove the `docs/CLAIMS.md` row. "Merged" and "Done" are different states — the issue closes only after the prod tail completes.

---

## PR Session State Template
The PR description is the sole handoff document.

```markdown
## Session State
**Status:** IN PROGRESS | DONE
**Completed:**
- [x] done task
**Next:** single specific action for next instance
```

Write `IN PROGRESS` before starting a large task. Write `DONE` after verifying. If context runs out mid-task, the skeleton commit is the fallback — it must exist before implementation begins.
