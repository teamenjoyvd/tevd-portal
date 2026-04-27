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
| Production URL | `https://tevd-portal.vercel.app` |

Never ask the user to confirm these.

---

## ID Format

```
[YYMM]-[TYPE]-[GH#]
```

- `YYMM` — year + month of creation (e.g. `2604` for April 2026)
- `TYPE` — `FEAT`, `BUG`, or `CHORE`
- `GH#` — the GitHub issue number assigned when the issue is created (no padding)

Examples: `2604-FEAT-61`, `2604-BUG-54`, `2604-CHORE-66`

| Artifact | Format |
|---|---|
| GitHub Issue title | `[2604-FEAT-61] Short description` |
| Branch | `feature/2604-FEAT-61` |
| Commit prefix | `[2604-FEAT-61] description` |
| PR title | `[2604-FEAT-61] description` |

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

- **NEVER push directly to `main`.** Feature branches only: `feature/[YYMM]-[TYPE]-[GH#]`.
- **NEVER create `middleware.ts`.** Auth lives in `proxy.ts`.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**
- **NEVER bypass Clerk auth on a protected route.**
- **NEVER mark Done on static analysis alone.** Vercel PR preview must be READY and CI green.
- **NEVER write data to Supabase from a Preview URL** — preview URLs hit production DB.
- **390px mobile-first.** Every new UI surface must render correctly at 390px.
- **RLS policies use Pattern A helpers only** — `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never raw `auth.jwt()`.
- **shadcn/ui for all interactive primitives** — dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog.
- **Component co-location** — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
- **Dual layout law** — NEVER a single responsive layout. Two complete separate layouts only. Canonical ref: `app/(dashboard)/about/page.tsx`.
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
| In flight | [YYMM]-[TYPE]-[GH#] <title> / None |
| Handoff   | IN PROGRESS: <next action> / DONE / CLAIM-complete: ready for SHAPE / No active PR |
| Commands  | SSU · PLAN · CLAIM · BUILD · PIU · GCR |
```
If GitHub ❌ — stop.

---

### PLAN — Read-only design

Pure thinking mode. **Zero writes of any kind.** No GitHub API calls except reads.

Invoke for a ticket or batch of tickets when the design is not yet settled.

For each ticket:
1. Read relevant REF.md / FLOWS.md / DECISIONS.md sections freely — no competing write budget.
2. Assess feasibility against the current codebase.
3. Produce a DoD as **specific verifiable checklist items with file paths**, not directional statements:
   ```
   ## DoD
   - [ ] `app/[route]/components/X.tsx` renders without overflow at 390px
   - [ ] `api/y/route.ts` returns 403 for non-admin Clerk userId
   ```
4. List affected files by path.
5. Flag applicable gotchas from the Gotchas table.
6. State verdict: **READY** or **BLOCKED: [single specific question]**.

Output lives in the conversation only. Nothing is written anywhere.

Re-entry: after a BLOCKED verdict is resolved, re-run PLAN scoped to that ticket to produce a READY verdict before CLAIM.

**Permitted:** GitHub reads (`get_file_contents`, `get_issue`, etc.)
**Forbidden:** `create_issue`, `update_issue`, `create_branch`, `create_or_update_file`, `push_files` — any write.

---

### CLAIM — Issue + branch scaffolding

Materialises a PLAN READY verdict into GitHub. Requires a READY verdict in the current session context, or a reference to an existing open issue that has a complete DoD but no `## Branch` section.

**If READY:**
1. `create_issue` — title (no ID yet), body containing DoD + affected files + gotchas + Design Checklist (all four items checked).
2. Read `GH#` from the response — this is the canonical identifier.
3. `update_issue` — rename title to `[YYMM-TYPE-GH#] description`.
4. `create_branch` → `feature/[YYMM]-[TYPE]-[GH#]` from `main`.
5. Confirm branch exists (check the returned ref).
6. **HARD GATE: if branch creation fails — comment `BLOCKED: branch creation failed` on the issue, apply `blocked` label, STOP.**
7. `update_issue` — write `## Branch` followed by `` `feature/[YYMM]-[TYPE]-[GH#]` `` into the issue body.

**If BLOCKED verdict from PLAN:**
1. `create_issue` with `blocked` label, body with DoD and `## Blocking Unknown` section containing the single question.
2. Read `GH#`, rename title to `[YYMM-TYPE-GH#] description`.
3. Stop — no branch creation.

Re-entry (existing issue, no branch): read the issue body, verify DoD is complete, then execute steps 4–7 above.

**Permitted:** `create_issue`, `update_issue`, `create_branch`.
**Forbidden:** `create_or_update_file`, `push_files`.

---

### BUILD — File execution

Default mode. Executes against a CLAIM-complete issue.

**Precondition:** Read the issue body. Verify `## Design Checklist` exists with all four items checked AND `## Branch` exists with the branch name. If either is absent or any item unchecked — stop, state exactly what is missing, do not proceed.

**READ** → Check open GitHub Issues. Resume any in-progress issue (open PR exists). If a CLAIM-complete issue has no open PR, that is the next issue — read `## Branch` from its body and proceed to SHAPE. Otherwise pick the highest `priority:high` open issue without the `blocked` label. If none, pick the next unlabelled issue by creation order.

**SHAPE (read-only)** → Verify the DoD is still coherent against current codebase state. Read relevant architecture docs:
   - Auth / role / Clerk sync → `FLOWS.md §1`
   - Registration → `FLOWS.md §2`
   - Payments → `FLOWS.md §3`
   - LOS / tree / notifications → `FLOWS.md §4`
   - Vital signs → `FLOWS.md §5`
   - New external dependency → update `C4.md` first
   - New architectural pattern → write ADR in `DECISIONS.md` before executing

   If DoD is stale or wrong: stop and request user to update the issue body before proceeding.
   **No writes (including issue body) in SHAPE.**

**GATHER** → Read only the REF.md sections the ticket needs (section map at top of REF.md).

**EXECUTE** → Change only lines required by DoD. All writes target the feature branch only. Push to trigger Vercel Preview.
- Before any large task (>100 lines): write `IN PROGRESS` to PR `## Session State` first, then commit a skeleton with `// TODO:` items before implementing.

**VERIFY** → DoD point-by-point. Vercel Preview READY. CI green. 390px check. No production side-effects.

**FINALIZE** → Mark PR ready for review. User merges manually via GitHub UI. After merge: confirm production Vercel deployment READY. Issue closes automatically via `Closes #N` in PR body.

### PR Session State block

The PR description is the sole handoff document.

```markdown
## Session State
**Status:** IN PROGRESS | DONE
**Completed:**
- [x] done thing
**Next:** single specific action for incoming instance
```

Write `IN PROGRESS` before starting a large task. Write `DONE` after verifying. If context runs out mid-task, the skeleton commit is the fallback — it must exist before implementation begins.

---

### PIU — Pack It Up

Run at session end:
1. Confirm PR `## Session State` is `DONE` — write it now if not already done.
2. If REF.md needs updates (schema changed, new routes, new env vars) — update and push in a single `push_files` call together with any other changed docs.
3. If nothing changed in REF.md — done.

---

### GCR — Address Gemini Code Review

See `docs/ai/GCR.md`.

---

## CLAIM-Complete Definition

An issue is CLAIM-complete (ready for BUILD) when its body contains:
1. A `## Design Checklist` section with all four items checked.
2. A `## Branch` section with the feature branch name.

```
## Design Checklist
- [x] DoD defined (specific, file-path-level)
- [x] Affected files listed by path
- [x] Gotchas flagged against Gotchas table
- [x] Blocking unknowns: none

## Branch
`feature/YYMM-TYPE-GH#`
```

BUILD verifies both at startup. If either section is absent or any checklist item is unchecked, BUILD refuses and states exactly what is missing.

---

## Gotchas

| Topic | Rule |
|---|---|
| `middleware.ts` | NEVER. Use `proxy.ts`. |
| Clerk auth | `await auth()` → `{ userId }`. No sync auth. No JWT template. |
| Clerk shadow DOM | CSS vars unavailable in Clerk components. Use hardcoded hex (`#bc4749`). |
| Role promotion | Every `profiles.role` update MUST also call `clerk.users.updateUserMetadata`. Routes: `/api/admin/verify`, `/api/admin/members/[id]` PATCH, `/api/admin/members/verify/[id]`. |
| `payments` FK | Two FKs to `profiles`. PostgREST MUST use `profiles!profile_id(...)` — without it, 500. |
| `types/supabase.ts` | Regenerate via `Supabase:generate_typescript_types` MCP only — CLI not installed. |
| Supabase DDL | `apply_migration` only. Never raw `execute_sql` for DDL. Always save to `supabase/migrations/YYYYMMDDNNNNNN_name.sql`. |
| Large GitHub files | `create_or_update_file` times out above ~10KB. Use `push_files`. |
| Mapbox | CDN only — never npm. Dupe guard on load. |
| Mapbox theme swap | `map.setStyle()` + `styledata` event. MutationObserver on `data-theme`. |
| shadcn install | NEVER `npx shadcn@latest init` — corrupts globals.css. Use `npx shadcn@latest add <n>`. After each add, revert any injected `@layer base` blocks. |
| shadcn CSS vars | Edit vended source in `components/ui/` to use project tokens (`--bg-card`, `--text-primary`) not shadcn defaults. |
| shadcn Tabs | NEVER `defaultValue`. Always `value={tab}` + `onValueChange` → `router.replace(?tab=..., { scroll: false })`. Wrap in `<Suspense>`. |
| `--bg-global-rgb` dark | MUST be `26, 31, 24`. Wrong value = white navbar in dark mode. |
| Admin forms | NEVER define a form component inside a parent page component — React remounts on every render. Hoist to module scope. |
| Admin Drawer | Use `components/ui/Drawer.tsx` for all admin create/edit. Exceptions: Announcements + Quick Links create = inline cards. All deletes use `AlertDialog`. |
| Route handler `params` | `params` is a `Promise` in Next.js 16. Type as `{ params: Promise<{ id: string }> }` and `await params`. |
| `useParams()` | Takes NO type argument in Next.js 16. `const params = useParams(); const id = params.id as string`. |
| `sendEmail` | Removed. Use `sendNotificationEmail` (fire-and-forget, respects config gates) or `sendTransactionalEmail` (bypasses gates, returns typed result). **Dynamic imports evade static rename tools and grep** — after any email-related rename, manually read every route using `import('@/lib/email/send')`. Known callers in `sendNotificationEmail` JSDoc. |
| `pg_net` cron | `net.http_post(...)`. NEVER `extensions.http_post(...)` — silently does nothing. |
| `TranslationKey` | Strict union. Add to `translations.ts` before using `t()` or build breaks. |
| `BottomNav.tsx` | Dead stub. Do not import. |
| Profile prerender | Guard ALL `validProfile!` accesses with `if (isLoading \|\| !validProfile) return <ProfileSkeleton />`. |
| `TeamAttendee` type | Exported from `app/(dashboard)/trips/[id]/page.tsx`. Do not redeclare. |

---

## When This File Is Wrong

If any instruction contradicts Next.js 16 / Clerk v7 / Supabase current SDK behaviour — stop, state the contradiction, cite correct behaviour, ask for a decision.
