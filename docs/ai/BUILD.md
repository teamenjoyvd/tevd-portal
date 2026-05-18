# BUILD — File execution

Default mode. Executes against a CLAIM-complete issue.

## Precondition

Read the issue body. Verify `## Design Checklist` exists with all four items checked AND `## Branch` exists with the branch name. If either is absent or any item unchecked — stop, state exactly what is missing, do not proceed.

## READ

Check open GitHub issues. Resume any in-progress issue (open PR exists). If a CLAIM-complete issue has no open PR, that is the next issue — read `## Branch` from its body and proceed to SHAPE. Otherwise pick the highest `priority:high` open issue without the `blocked` label. If none, pick the next unlabelled issue by creation order.

## SHAPE (read-only)

Verify the DoD is still coherent against current codebase state. Read relevant architecture docs:

- Auth / role / Clerk sync → `FLOWS.md §1`
- Registration → `FLOWS.md §2`
- Payments → `FLOWS.md §3`
- LOS / tree / notifications → `FLOWS.md §4`
- Vital signs → `FLOWS.md §5`
- New external dependency → update `C4.md` first
- New architectural pattern → write ADR in `DECISIONS.md` before executing

If DoD is stale or wrong: stop and request user to update the issue body before proceeding.

**No writes (including issue body) in SHAPE.**

## GATHER

Read only the REF.md sections the ticket needs (section map at top of REF.md).

## EXECUTE

Change only lines required by DoD. All writes target the feature branch only. Push to trigger Vercel Preview.

Before any large task (>100 lines): write `IN PROGRESS` to PR `## Session State` first, then commit a skeleton with `// TODO:` items before implementing.

## VERIFY

DoD point-by-point. Vercel Preview READY. CI green (`check-types` — runs `tsc --noEmit` on PRs targeting `main`). 390px check. No production side-effects. If ticket touched auth or routing: confirm `middleware.ts` does not exist.

## FINALIZE

Verify PR body contains `Closes #<issue_number>` — if missing, add it now. Mark PR ready for review. If this ticket ran a migration or changed a column/table/route/env var: update `docs/ai/REF.md` before marking DONE. User merges manually via GitHub UI. After merge: confirm production Vercel deployment READY.

## PR Session State block

The PR description is the sole handoff document.

```markdown
## Session State
**Status:** IN PROGRESS | DONE
**Completed:**
- [x] done thing
**Next:** single specific action for incoming instance
```

Write `IN PROGRESS` before starting a large task. Write `DONE` after verifying. If context runs out mid-task, the skeleton commit is the fallback — it must exist before implementation begins.
