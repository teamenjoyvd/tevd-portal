# CLAIM — Issue & Branch Scaffolding
Materializes a PLAN verdict into GitHub. Requires a verdict from the current session or a reference to an open issue with a complete DoD but no branch.

## 1. If PLAN Verdict is READY
1. **Create Issue:** Call `create_issue` with the DoD, affected files, gotchas, and `## Design Checklist` (all checked).
2. **Assign ID:** Get `GH#` from the response and rename the issue title to `[YYMM-DEV-GH#] description` using `update_issue`.
3. **Scaffold Branch:** Call `create_branch` to create `dev/[YYMM]-DEV-[GH#]` from `main`.
   - **Hard Gate:** If branch creation fails, comment `BLOCKED: branch creation failed` on the issue, label it `blocked`, and STOP.
4. **Link Branch:** Call `update_issue` to append `## Branch` to the issue body.

## 2. If PLAN Verdict is BLOCKED
1. **Create Issue:** Call `create_issue` with the `blocked` label, the DoD, and a `## Blocking Unknown` section with the unresolved question.
2. **Assign ID:** Get `GH#` and rename the issue title to `[YYMM-DEV-GH#] description`.
3. **Stop:** Do not create a branch.

## 3. Re-entry
If an issue exists with a completed DoD but no branch, verify the DoD and perform Branch Scaffolding (Steps 3-4 under Section 1).

## Rules
- **Permitted:** `create_issue`, `update_issue`, `create_branch`
- **Forbidden:** Codebase writes (`create_or_update_file`, `push_files`)
