# CLAUDE.md — teamenjoyVD Portal
> Reference: `docs/ai/REF.md` (read on demand at GATHER, sections only)
> Architecture: `docs/architecture/` (FLOWS.md, DECISIONS.md, C4.md)

---

## Constants

| | |
|---|---|
| Repo | `teamenjoyvd/tevd-portal` |
| Branch | `main` |
| Supabase project | `ynykjpnetfwqzdnsgkkg` |
| Production URL | `https://www.teamenjoyvd.com` |

Never ask the user to confirm these.

---

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

---

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

---

## Hard Constraints

Violation = immediate stop, no exceptions.

- **NEVER push directly to `main`.** Use `dev/[YYMM]-DEV-[GH#]` branches only.
- **NEVER create `middleware.ts`.** Auth lives in `proxy.ts`.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**
- **NEVER bypass Clerk auth on a protected route.**
- **NEVER mark Done on static analysis alone.** Vercel PR preview must be READY and CI green.
- **NEVER write data to Supabase from a Preview URL** — preview URLs hit production DB.
- **390px mobile-first.** Every new UI surface must render correctly at 390px.
- **RLS policies use Pattern A helpers only** — `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never raw `auth.jwt()`.
- **shadcn/ui for all interactive primitives** — dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog.
- **Component co-location** — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
- **Layout Decision Rules (Quantitative)** — Default is a single responsive layout file. Dual layout (separate files) is required only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. Refer to `.cursor/rules/frontend.mdc` for precise triggers.
- **NEVER call `create_or_update_file` or `push_files` before CLAIM is complete.** No file writes until the feature branch exists and is confirmed.
- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.

---

## Commands

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

### PLAN — See `docs/ai/PLAN.md`

### CLAIM — See `docs/ai/CLAIM.md`

### BUILD — See `docs/ai/BUILD.md`

### GCR — See `docs/ai/GCR.md`

---

## CLAIM-Complete Definition

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

---

## Gotchas

See `docs/ai/GOTCHAS.md`. Read in full during SHAPE and GATHER.
