# BUILD — Execution Mode

Default mode. Executes code changes against a CLAIM-completed issue.

## 1. Precondition

Read the issue body. Verify `## Design Checklist` exists with all four items checked AND `## Branch` exists with the branch name. If either is absent or any item unchecked — stop, state exactly what is missing, do not proceed.
(Antigravity Check: Also initialize/verify the `task.md` artifact in the brain directory at startup).

## 2. Stages

### READ & SHAPE (Read-only)
- Find in-progress issues (open PRs) or CLAIM-completed issues. If none, pick the highest `priority:high` open issue without the `blocked` label.
- Verify the DoD is coherent with the current codebase. Rely on `.cursor/rules/`, `docs/ai/RULES.md` and project architecture docs:
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
- Code only what is required by the DoD. All changes target the feature branch only. Push to trigger Vercel Preview.
- For large tasks (>100 lines), commit a skeleton with `// TODO:` items before implementing, and update the PR Session State to `IN PROGRESS`.

### VERIFY
- Verify DoD point-by-point.
- Check Vercel Preview is READY and CI is green (`check-types` — runs `tsc --noEmit` on PRs targeting `main`).
- Ensure 390px mobile responsiveness.
- Ensure no production side-effects. If ticket touched auth or routing: confirm `middleware.ts` does not exist.

### FINALIZE
- Add `Closes #<issue_number>` to the PR body. Mark the PR as ready for review.
- Update the PR description's `## Session State` block.
- Update `docs/ai/REF.md` if schema, tables, routes, or env vars changed.
- Confirm production Vercel deployment is READY after merge.

---

## PR Session State Template
The PR description is the sole handoff document.

```markdown
## Session State
**Agent Type:** Antigravity | Claude
**Status:** IN PROGRESS | DONE
**Completed:**
- [x] done task
**Next:** single specific action for next instance
```

Write `IN PROGRESS` before starting a large task. Write `DONE` after verifying. If context runs out mid-task, the skeleton commit is the fallback — it must exist before implementation begins.
