# PROJECT.md — teamenjoyVD Portal (migrated project content)

Project-authored archive. Content transported verbatim from the pre-migration `CLAUDE.md` and `docs/ai/RULES.md` during the guardrails-kit v1.0 migration (2026-07-06). Exempt from `docs/guardrails/_FORMAT.md` doc-shape rules. Every `##` anchor below is reachable from a `## Project` pointer in `CLAUDE.md`. (The `## Workflow commands` anchor was `## Commands` in the pre-migration CLAUDE.md — heading repurposed as the nav anchor; body verbatim.)

## ID Format

```
[YYMM]-DEV-[GH#]
```

- `YYMM` — year + month of creation (e.g. `2605` for May 2026)
- `DEV` — fixed segment, all work types
- `GH#` — the GitHub issue number assigned when the issue is created (no padding)

Examples: `2605-DEV-171`, `2605-DEV-182`

| Artifact | Format |
|---|---|
| GitHub Issue title | `[2605-DEV-171] Short description` |
| Branch | `dev/2605-DEV-171` |
| Commit prefix | `[2605-DEV-171] description` |
| PR title | `[2605-DEV-171] description` |

The GitHub issue number is the canonical unique identifier. It is assigned atomically by GitHub — no counter to maintain, no inference required. Never check existing issue numbers and increment — always create the issue and read the number from the response.

## GitHub Issue Labels

| Label | Purpose |
|---|---|
| `feat` | New functionality |
| `bug` | Something broken |
| `chore` | Refactor, deps, infrastructure |
| `priority:high` | Pick before anything else |
| `priority:low` | Pick last |
| `blocked` | Do not pick — has a dependency that isn't resolved |

READ order: `priority:high` first, then unlabelled, then `priority:low`. Never pick a `blocked` issue without explicit user acknowledgment.

## Workflow commands

### SSU — System Startup

Run at the start of every session. Warms up tools and establishes ground truth before any other action.

1. **Tool warm-up (before anything else):**
   - `tool_search("get file contents github")`
   - `tool_search("branch issue pull request create")`
   Confirm both return results. If either fails — stop.

2. `get_file_contents` on `CLAUDE.md` — confirms GitHub connectivity and loads current state.

3. `list_pull_requests` — check for any open PRs.
   - **Open PR found:** read its `## Session State` block and report what's in flight before doing anything else.
   - **No open PR, but a CLAIM-complete issue exists** (has `## Branch` block, no PR): report as CLAIM-complete/BUILD-not-started → ready to proceed to SHAPE.
   - **Nothing in flight:** report ready to pick up next issue.

Output format:
```
| GitHub    | ✅/❌ |
| In flight | [YYMM]-DEV-[GH#] <title> / None |
| Handoff   | IN PROGRESS: <next action> / DONE / CLAIM-complete: ready for SHAPE / No active PR |
| Commands  | SSU · PLAN · CLAIM · BUILD · GCR |
```
If GitHub ❌ — stop.

4. **Print the dev process** (verbatim, after the status table):
```
Dev process (one phase per session):
 1. PLAN   — design only, no writes; scope + files + migration needs land in the issue
 2. CLAIM  — overlap-check docs/CLAIMS.md, cut dev/[YYMM]-DEV-[GH#], register claim row
 3. BUILD  — build locally vs hosted DEV Supabase; migrations applied + verified on dev DB only
 4. Review — /code-review low on the diff, fix findings locally (before any push)
 5. Draft  — push branch, open PR as DRAFT (CodeRabbit skips drafts); wait CI green + preview READY
 6. Ready  — mark PR ready → one CodeRabbit pass; fix all findings in ONE batched push
 7. Merge  — CI green + preview READY + threads resolved; GCR: remove claim row, close issue
 8. Prod   — apply the dev-verified migration to prod, smoke-check production URL
```

### PLAN — See `docs/ai/PLAN.md`

### CLAIM — See `docs/ai/CLAIM.md`

### BUILD — See `docs/ai/BUILD.md` (executed via the `anthropic-skills:build` skill when available)

### GCR — See `docs/ai/GCR.md` (executed via the `anthropic-skills:gcr` skill when available)

## CLAIM-Complete Definition

Before CLAIM completes: read `docs/CLAIMS.md` and check whether any in-flight row overlaps the files/areas this issue will touch. An overlap found -> surface it to the user before cutting the branch, do not silently proceed (this repo runs concurrent agent sessions with loosely-bounded scope; overlap has already caused a real merge collision — PR #538 vs. 2607-DEV-535, both independently adding a debounce to the same search input). No overlap -> `git pull` and re-read `docs/CLAIMS.md` one more time immediately before committing, then add a row (issue #, branch, files/areas, timestamp) as the last step of completing CLAIM — this shrinks but does not eliminate the race between two agents both checking before either commits (see `docs/CLAIMS.md`'s "Race window" note; a markdown file cannot guarantee atomicity). Remove the row once BUILD's PR merges or the branch is abandoned.

An issue is CLAIM-complete (ready for BUILD) when its body contains:
1. A `## Design Checklist` section with all four items checked.
2. A `## Branch` section with the feature branch name.

```
## Design Checklist
- [x] DoD defined (specific, file-path-level)
- [x] Affected files listed by path
- [x] Gotchas flagged against docs/ai/GOTCHAS.md
- [x] Blocking unknowns: none

## Branch
`dev/YYMM-DEV-GH#`
```

BUILD verifies both at startup. If either section is absent or any checklist item is unchecked, BUILD refuses and states exactly what is missing.

## Gotchas

See `docs/ai/GOTCHAS.md`. Read in full during SHAPE and GATHER.

## Carried technical notes

_Transported verbatim from `docs/ai/RULES.md` §1-§2 (pre-migration). The unique items that had no equivalent in the pre-migration CLAUDE.md Hard Constraints._

**Detail-table access gating / payments two-FK join** (RULES.md §2):
- **Detail Table Access Gating:**
  - This project's schema does not have an `interactions`-style detail-table pattern (no `call_details` / `email_details` / `note_details` tables exist). If a future table needs gating via a parent-row `EXISTS` check rather than a direct `profile_id` column, model it on the real comparable case in this codebase: the `payments` table's two-FK ambiguity to `profiles` (see §5 Schema in `docs/ai/REF.md` — any PostgREST join MUST use `profiles!profile_id(...)`).

**Supabase Cookie method type mapping** (RULES.md §2):
- **Supabase Cookie method type mapping:**
  - Do not derive database types from `CookieMethodsServer['setAll']` (breaks since `setAll` is optional).
  - Use the explicit type: `{ name: string; value: string; options?: Record<string, unknown> }`.

**Clerk authentication check** (RULES.md §1):
- **Clerk Authentication:**
  - All protected routes must asynchronously check `userId` from `@clerk/nextjs/server`:
    ```typescript
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    ```
  - **NEVER** bypass, mock, or omit authentication checks on protected endpoints.
