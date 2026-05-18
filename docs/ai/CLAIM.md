# CLAIM — Issue + branch scaffolding

Materialises a PLAN READY verdict into GitHub. Requires a READY verdict in the current session context, or a reference to an existing open issue that has a complete DoD but no `## Branch` section.

## If READY

1. `create_issue` — title (no ID yet), body containing DoD + affected files + gotchas + Design Checklist (all four items checked).
2. Read `GH#` from the response — this is the canonical identifier.
3. `update_issue` — rename title to `[YYMM-DEV-GH#] description`.
4. `create_branch` → `dev/[YYMM]-DEV-[GH#]` from `main`.
5. Confirm branch exists (check the returned ref).
6. **HARD GATE: if branch creation fails — comment `BLOCKED: branch creation failed` on the issue, apply `blocked` label, STOP.**
7. `update_issue` — append `## Branch` followed by `` `dev/[YYMM]-DEV-[GH#]` `` to the issue body.

## If BLOCKED verdict from PLAN

1. `create_issue` with `blocked` label, body with DoD and `## Blocking Unknown` section containing the single question.
2. Read `GH#`, rename title to `[YYMM-DEV-GH#] description`.
3. Stop — no branch creation.

## Re-entry

Existing issue with no branch: read the issue body, verify DoD is complete, then execute steps 4–7 above.

## Permitted / Forbidden

**Permitted:** `create_issue`, `update_issue`, `create_branch`.

**Forbidden:** `create_or_update_file`, `push_files`.
