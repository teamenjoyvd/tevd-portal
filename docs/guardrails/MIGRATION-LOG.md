# MIGRATION-LOG.md — guardrails-kit v1.0 migration

Repo: teamenjoyvd/tevd-portal
Migration started: 2026-07-06
Mode: FULL migration (Phase 0: CLAUDE.md exists, no `guardrails-kit:` sentinel, no orphaned log).

This log is authored by the migration procedure (MIGRATE.md). It is exempt from _FORMAT.md doc-shape rules.

---

## Surfaces

Discovery run per M1 (standard globs) plus the four extra instruction surfaces the user flagged.
Decision key: **MIGRATE** (content pulled into the new kit structure) / **LEAVE** (stays in place, still referenced) / **FLAG-to-user** (needs a decision at M5).

### Standard discovery (M1 globs)

| # | Surface | Status | Decision | Reason |
|---|---|---|---|---|
| S-01 | `CLAUDE.md` (root, 138 lines, `bbff77d0`) | EXISTS | **MIGRATE** | Primary target. Restructured into kit zones 1/2/3; every line dispositioned in the M3 table. |
| S-02 | `**/CLAUDE.local.md` | none | N/A | No file. |
| S-03 | nested `**/CLAUDE.md` | none (only root) | N/A | No nested overrides; no per-subtree token scan needed. |
| S-04 | `.claude/settings.json` | none | N/A | No file. |
| S-05 | `.claude/settings.local.json` | EXISTS | **LEAVE** | `permissions.allow` allowlist only. **No `hooks` key** — nothing injected/enforced at SessionStart/PostToolUse. Not a rules surface. |
| S-06 | `.claude/commands` `/agents` `/skills` | none | N/A | Directories do not exist. |
| S-07 | `@`-imports inside CLAUDE.md (`^@`) | none | N/A | `grep -n "^@" CLAUDE.md` → 0 hits. No import lines to carry. |
| S-08 | user-global `~/.claude/CLAUDE.md` | out of scope | **LEAVE** | Read-only per M1: never edited, never copied into the project. |

### Extra instruction surfaces (user-flagged + discovered)

| # | Surface | Status | Decision | Reason / handling |
|---|---|---|---|---|
| S-09 | `docs/ai/RULES.md` (66 lines) — second "master" constraints doc ("FUAR") | EXISTS | **MIGRATE (content) + FLAG-to-user (file fate)** | Duplicates most CLAUDE.md Hard Constraints → those lines **SUPERSEDED-BY** the migrated CLAUDE.md constraints. Two **unique** items **MOVED** (not dropped): (a) L36–38 Supabase `CookieMethodsServer['setAll']` type note; (b) L35 payments two-FK `profiles!profile_id(...)` join note. §4 Multi-Agent Coexistence (L59–66) → **zone-2 `## Project`** line so it is visible at SSU. Accounted for in the **Supplementary disposition table** below. FLAG: what happens to the now-redundant physical RULES.md (delete / keep as thin pointer for Antigravity)? — live 1:1 multi-agent parity requirement. |
| S-10 | `docs/ai/GEMINI.md` (second agent persona/rules) | EXISTS | **LEAVE** | Already declares "Strictly enforce all Hard Constraints from `CLAUDE.md`" — sources its laws from CLAUDE.md. Post-migration check (M8-adjacent): confirm new CLAUDE.md still carries no-`middleware.ts`, dual-layout law, shadcn primitives, 390px. |
| S-11 | `docs/ai/system-prompt.xml` (versioned Claude system prompt; PLAN/BUILD + Optimal:/Critique: modes) | EXISTS | **LEAVE (file) + FLAG-to-user (described internal conflict)** | User reported a `<critique_mode><rules>` vs `<output_structure><Deviations>` contradiction over deviation anchoring. **On inspection the two blocks already AGREE** (both: "file path where one exists, named architectural decision otherwise"). Logged as CONFLICT-PENDING (self-referential) in `## CONFLICTS`, presented verbatim at M5 — will NOT silently pick a wording. |
| S-12 | `docs/ai/REFACTOR.md` (539 lines) — living refactor-findings log | EXISTS | **UNSORTED → PROJECT-NOTES.md** | Project history/working data, not a rule surface. Transported verbatim, in full, into `docs/guardrails/PROJECT-NOTES.md` at Phase 6. No target entry summarized or dropped. |

### Other docs/ai + .cursor surfaces (referenced by CLAUDE.md / other agents)

| # | Surface | Decision | Reason |
|---|---|---|---|
| S-13 | `docs/ai/BUILD.md` | **LEAVE** | BUILD workflow; referenced by CLAUDE.md `### BUILD`. Zone-2 pointer carried. |
| S-14 | `docs/ai/CLAIM.md` | **LEAVE** | CLAIM workflow; referenced by CLAUDE.md `### CLAIM`. |
| S-15 | `docs/ai/PLAN.md` | **LEAVE** | Project PLAN workflow; referenced by CLAUDE.md `### PLAN`, GEMINI.md, RULES.md §4. **Distinct path** from kit `docs/guardrails/PLAN.md` — NOT a collision. |
| S-16 | `docs/ai/GCR.md` | **LEAVE** | GCR workflow; referenced by CLAUDE.md `### GCR`. |
| S-17 | `docs/ai/GOTCHAS.md` | **LEAVE** | Referenced by CLAUDE.md `## Gotchas`; read during SHAPE/GATHER. |
| S-18 | `docs/ai/REF.md` | **LEAVE** | Reference doc; referenced by CLAUDE.md header, GEMINI.md, system-prompt.xml, RULES.md §2. |
| S-19 | `docs/ai/CONTEXT.md` | **LEAVE** | Reference; referenced by GEMINI.md / system-prompt.xml. |
| S-20 | `docs/ai/QA.md` | **LEAVE** | QA reference doc. |
| S-21 | `docs/ai/archive/{CONTEXT,LOOKUP,REFACTOR}.md` | **LEAVE** | Archived; GEMINI.md notes LOOKUP.md "no longer exists — do not recreate". |
| S-22 | `.cursor/rules/{auth,database,frontend}.mdc` | **LEAVE** | Cursor agent rule surface; `frontend.mdc` referenced by CLAUDE.md + RULES.md layout rules. Not a Claude/kit surface — left in place. |

### Kit-doc name-collision check (for M6a)

`docs/guardrails/` does not exist yet → **zero** existing files share a kit doc name (`_FORMAT/PLAN/CODE/DEBUG/VERIFY/EFFICIENCY/SESSION/TRAPS`). No M6a a/b/c collision question required.
Note: `docs/ai/PLAN.md` shares the *name* "PLAN.md" with kit `docs/guardrails/PLAN.md` but lives in a **different directory** — not a collision; both coexist.

---

## Snapshot (M2)

- `CLAUDE.md.pre-migration-20260706-1720` — 138 lines — `git hash-object`: `bbff77d024f99ac93b6dce7448c45943cc24f7e0`
- `docs/ai/RULES.md.pre-migration-20260706-1720` — 65 lines — `git hash-object`: `2b03849d00b2d8ea95a3b0afb9e027445bf44f33`
- **SNAPSHOT-UNCOMMITTED**: `git status --porcelain` (excluding snapshots) shows `?? docs/guardrails/` — the working tree is dirty because of this migration log itself, so per M2 the snapshot is NOT auto-committed. The snapshot files sit on disk as the backup; the user removes them after accepting the migration. (Also consistent with the project rule of not committing unless asked.)

---

## Disposition table (M3)

Source: `CLAUDE.md.pre-migration-20260706-1720`. Numbering is over **non-blank lines only** (blanks skipped), one original line → exactly one row.
Destinations: `CLAUDE.md ## Project` = zone 2 of the new CLAUDE.md; `PROJECT.md#<anchor>` = `docs/guardrails/PROJECT.md`.

| # | file-L | original text (verbatim) | disposition | destination | note |
|---|---|---|---|---|---|
| 001 | 1 | `# CLAUDE.md — teamenjoyVD Portal` | DROPPED | — | document H1 title; decoration. New CLAUDE.md opens with kit sentinel + KIT CORE. |
| 002 | 2 | `> Reference: `docs/ai/REF.md` (read on demand at GATHER, sections only)` | MOVED | CLAUDE.md ## Project | reference pointer, kept verbatim |
| 003 | 3 | `> Architecture: `docs/architecture/` (FLOWS.md, DECISIONS.md, C4.md)` | MOVED | CLAUDE.md ## Project | reference pointer, kept verbatim |
| 004 | 5 | `---` | DROPPED | — | horizontal-rule divider; decoration |
| 005 | 7 | `## Constants` | MOVED | CLAUDE.md ## Project | heading → zone-2 bold label `**Constants**` |
| 006 | 9 | `| | |` | KEPT-VERBATIM | CLAUDE.md ## Project | constants table header (transported whole) |
| 007 | 10 | `|---|---|` | KEPT-VERBATIM | CLAUDE.md ## Project | constants table separator (intra-table syntax) |
| 008 | 11 | `| Repo | `teamenjoyvd/tevd-portal` |` | KEPT-VERBATIM | CLAUDE.md ## Project | canonical fact |
| 009 | 12 | `| Branch | `main` |` | KEPT-VERBATIM | CLAUDE.md ## Project | canonical fact |
| 010 | 13 | `| Supabase project | `ynykjpnetfwqzdnsgkkg` |` | KEPT-VERBATIM | CLAUDE.md ## Project | canonical fact |
| 011 | 14 | `| Production URL | `https://www.teamenjoyvd.com` |` | KEPT-VERBATIM | CLAUDE.md ## Project | canonical fact |
| 012 | 16 | `Never ask the user to confirm these.` | KEPT-VERBATIM | CLAUDE.md ## Project | constants rider |
| 013 | 18 | `---` | DROPPED | — | divider; decoration |
| 014 | 20 | `## ID Format` | MOVED | PROJECT.md#id-format | heading → PROJECT.md anchor |
| 015 | 22 | ```` ``` ```` | MOVED | PROJECT.md#id-format | code-fence open (part of transported block) |
| 016 | 23 | `[YYMM]-DEV-[GH#]` | MOVED | PROJECT.md#id-format | the ID format itself |
| 017 | 24 | ```` ``` ```` | MOVED | PROJECT.md#id-format | code-fence close |
| 018 | 26 | `- `YYMM` — year + month of creation (e.g. `2605` for May 2026)` | MOVED | PROJECT.md#id-format | |
| 019 | 27 | `- `DEV` — fixed segment, all work types` | MOVED | PROJECT.md#id-format | |
| 020 | 28 | `- `GH#` — the GitHub issue number assigned when the issue is created (no padding)` | MOVED | PROJECT.md#id-format | |
| 021 | 30 | `Examples: `2605-DEV-171`, `2605-DEV-182`` | MOVED | PROJECT.md#id-format | |
| 022 | 32 | `| Artifact | Format |` | MOVED | PROJECT.md#id-format | artifact table header |
| 023 | 33 | `|---|---|` | MOVED | PROJECT.md#id-format | artifact table separator |
| 024 | 34 | `| GitHub Issue title | `[2605-DEV-171] Short description` |` | MOVED | PROJECT.md#id-format | |
| 025 | 35 | `| Branch | `dev/2605-DEV-171` |` | MOVED | PROJECT.md#id-format | |
| 026 | 36 | `| Commit prefix | `[2605-DEV-171] description` |` | MOVED | PROJECT.md#id-format | |
| 027 | 37 | `| PR title | `[2605-DEV-171] description` |` | MOVED | PROJECT.md#id-format | |
| 028 | 39 | `The GitHub issue number is the canonical unique identifier. It is assigned atomically by GitHub — no counter to maintain, no inference required. Never check existing issue numbers and increment — always create the issue and read the number from the response.` | MOVED | PROJECT.md#id-format | |
| 029 | 41 | `---` | DROPPED | — | divider; decoration |
| 030 | 43 | `## GitHub Issue Labels` | MOVED | PROJECT.md#github-issue-labels | heading → anchor |
| 031 | 45 | `| Label | Purpose |` | MOVED | PROJECT.md#github-issue-labels | label table header |
| 032 | 46 | `|---|---|` | MOVED | PROJECT.md#github-issue-labels | separator |
| 033 | 47 | `| `feat` | New functionality |` | MOVED | PROJECT.md#github-issue-labels | |
| 034 | 48 | `| `bug` | Something broken |` | MOVED | PROJECT.md#github-issue-labels | |
| 035 | 49 | `| `chore` | Refactor, deps, infrastructure |` | MOVED | PROJECT.md#github-issue-labels | |
| 036 | 50 | `| `priority:high` | Pick before anything else |` | MOVED | PROJECT.md#github-issue-labels | |
| 037 | 51 | `| `priority:low` | Pick last |` | MOVED | PROJECT.md#github-issue-labels | |
| 038 | 52 | `| `blocked` | Do not pick — has a dependency that isn't resolved |` | MOVED | PROJECT.md#github-issue-labels | |
| 039 | 54 | `READ order: `priority:high` first, then unlabelled, then `priority:low`. Never pick a `blocked` issue without explicit user acknowledgment.` | MOVED | PROJECT.md#github-issue-labels | |
| 040 | 56 | `---` | DROPPED | — | divider; decoration |
| 041 | 58 | `## Hard Constraints` | MOVED | CLAUDE.md ## Project | heading → zone-2 bold label `**Hard Constraints**` |
| 042 | 60 | `Violation = immediate stop, no exceptions.` | KEPT-VERBATIM | CLAUDE.md ## Project | constraints intro |
| 043 | 62 | `- **NEVER push directly to `main`.** Use `dev/[YYMM]-DEV-[GH#]` branches only.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law; orthogonal to kit "never push unless asked" (branch policy, not a conflict) |
| 044 | 63 | `- **NEVER create `middleware.ts`.** Auth lives in `proxy.ts`.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law; GEMINI.md depends on this staying in CLAUDE.md |
| 045 | 64 | `- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**` | KEPT-VERBATIM | CLAUDE.md ## Project | project law |
| 046 | 65 | `- **NEVER bypass Clerk auth on a protected route.**` | KEPT-VERBATIM | CLAUDE.md ## Project | project law |
| 047 | 66 | `- **NEVER mark Done on static analysis alone.** Vercel PR preview must be READY and CI green.` | KEPT-VERBATIM | CLAUDE.md ## Project | project-specific DoD; compatible with & stricter than VERIFY.md (fresh evidence) — no conflict |
| 048 | 67 | `- **NEVER write data to Supabase from a Preview URL** — preview URLs hit production DB.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law |
| 049 | 68 | `- **390px mobile-first.** Every new UI surface must render correctly at 390px.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law; GEMINI.md dependency |
| 050 | 69 | `- **RLS policies use Pattern A helpers only** — `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never raw `auth.jwt()`.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law |
| 051 | 70 | `- **shadcn/ui for all interactive primitives** — dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law; GEMINI.md dependency |
| 052 | 71 | `- **Component co-location** — new components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law |
| 053 | 72 | `- **Layout Decision Rules (Quantitative)** — Default is a single responsive layout file. Dual layout (separate files) is required only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. Refer to `.cursor/rules/frontend.mdc` for precise triggers.` | KEPT-VERBATIM | CLAUDE.md ## Project | project law; GEMINI.md "dual layout law" dependency |
| 054 | 73 | `- **NEVER call `create_or_update_file` or `push_files` before CLAIM is complete.** No file writes until the feature branch exists and is confirmed.` | KEPT-VERBATIM | CLAUDE.md ## Project | project workflow law |
| 055 | 74 | `- **SSU, PLAN, CLAIM, and BUILD are mutually exclusive within a session.** PLAN does no writes of any kind. CLAIM does no file writes. BUILD does no design work. Violation = immediate stop.` | KEPT-VERBATIM | CLAUDE.md ## Project | project workflow law |
| 056 | 76 | `---` | DROPPED | — | divider; decoration |
| 057 | 78 | `## Commands` | MOVED | PROJECT.md#workflow-commands | heading → anchor |
| 058 | 80 | `### SSU — System Startup` | MOVED | PROJECT.md#workflow-commands | |
| 059 | 82 | `Run at the start of every session. Warms up tools and establishes ground truth before any other action.` | MOVED | PROJECT.md#workflow-commands | |
| 060 | 84 | `1. **Tool warm-up (before anything else):**` | MOVED | PROJECT.md#workflow-commands | |
| 061 | 85 | `   - `tool_search("get file contents github")`` | MOVED | PROJECT.md#workflow-commands | |
| 062 | 86 | `   - `tool_search("branch issue pull request create")`` | MOVED | PROJECT.md#workflow-commands | |
| 063 | 87 | `   Confirm both return results. If either fails — stop.` | MOVED | PROJECT.md#workflow-commands | |
| 064 | 89 | `2. `get_file_contents` on `CLAUDE.md` — confirms GitHub connectivity and loads current state.` | MOVED | PROJECT.md#workflow-commands | |
| 065 | 91 | `3. `list_pull_requests` — check for any open PRs.` | MOVED | PROJECT.md#workflow-commands | |
| 066 | 92 | `   - **Open PR found:** read its `## Session State` block and report what's in flight before doing anything else.` | MOVED | PROJECT.md#workflow-commands | |
| 067 | 93 | `   - **No open PR, but a CLAIM-complete issue exists** (has `## Branch` block, no PR): report as CLAIM-complete/BUILD-not-started → ready to proceed to SHAPE.` | MOVED | PROJECT.md#workflow-commands | |
| 068 | 94 | `   - **Nothing in flight:** report ready to pick up next issue.` | MOVED | PROJECT.md#workflow-commands | |
| 069 | 96 | `Output format:` | MOVED | PROJECT.md#workflow-commands | |
| 070 | 97 | ```` ``` ```` | MOVED | PROJECT.md#workflow-commands | code-fence open |
| 071 | 98 | `| GitHub    | ✅/❌ |` | MOVED | PROJECT.md#workflow-commands | |
| 072 | 99 | `| In flight | [YYMM]-DEV-[GH#] <title> / None |` | MOVED | PROJECT.md#workflow-commands | |
| 073 | 100 | `| Handoff   | IN PROGRESS: <next action> / DONE / CLAIM-complete: ready for SHAPE / No active PR |` | MOVED | PROJECT.md#workflow-commands | |
| 074 | 101 | `| Commands  | SSU · PLAN · CLAIM · BUILD · GCR |` | MOVED | PROJECT.md#workflow-commands | |
| 075 | 102 | ```` ``` ```` | MOVED | PROJECT.md#workflow-commands | code-fence close |
| 076 | 103 | `If GitHub ❌ — stop.` | MOVED | PROJECT.md#workflow-commands | |
| 077 | 105 | `### PLAN — See `docs/ai/PLAN.md`` | MOVED | PROJECT.md#workflow-commands | pointer preserved; docs/ai/PLAN.md LEAVE |
| 078 | 107 | `### CLAIM — See `docs/ai/CLAIM.md`` | MOVED | PROJECT.md#workflow-commands | pointer preserved; docs/ai/CLAIM.md LEAVE |
| 079 | 109 | `### BUILD — See `docs/ai/BUILD.md`` | MOVED | PROJECT.md#workflow-commands | pointer preserved; docs/ai/BUILD.md LEAVE |
| 080 | 111 | `### GCR — See `docs/ai/GCR.md`` | MOVED | PROJECT.md#workflow-commands | pointer preserved; docs/ai/GCR.md LEAVE |
| 081 | 113 | `---` | DROPPED | — | divider; decoration |
| 082 | 115 | `## CLAIM-Complete Definition` | MOVED | PROJECT.md#claim-complete-definition | heading → anchor |
| 083 | 117 | `An issue is CLAIM-complete (ready for BUILD) when its body contains:` | MOVED | PROJECT.md#claim-complete-definition | |
| 084 | 118 | `1. A `## Design Checklist` section with all four items checked.` | MOVED | PROJECT.md#claim-complete-definition | |
| 085 | 119 | `2. A `## Branch` section with the feature branch name.` | MOVED | PROJECT.md#claim-complete-definition | |
| 086 | 121 | ```` ``` ```` | MOVED | PROJECT.md#claim-complete-definition | code-fence open |
| 087 | 122 | `## Design Checklist` | MOVED | PROJECT.md#claim-complete-definition | literal text inside code block |
| 088 | 123 | `- [x] DoD defined (specific, file-path-level)` | MOVED | PROJECT.md#claim-complete-definition | |
| 089 | 124 | `- [x] Affected files listed by path` | MOVED | PROJECT.md#claim-complete-definition | |
| 090 | 125 | `- [x] Gotchas flagged against docs/ai/GOTCHAS.md` | MOVED | PROJECT.md#claim-complete-definition | |
| 091 | 126 | `- [x] Blocking unknowns: none` | MOVED | PROJECT.md#claim-complete-definition | |
| 092 | 128 | `## Branch` | MOVED | PROJECT.md#claim-complete-definition | literal text inside code block |
| 093 | 129 | `` `dev/YYMM-DEV-GH#` `` | MOVED | PROJECT.md#claim-complete-definition | |
| 094 | 130 | ```` ``` ```` | MOVED | PROJECT.md#claim-complete-definition | code-fence close |
| 095 | 132 | `BUILD verifies both at startup. If either section is absent or any checklist item is unchecked, BUILD refuses and states exactly what is missing.` | MOVED | PROJECT.md#claim-complete-definition | |
| 096 | 134 | `---` | DROPPED | — | divider; decoration |
| 097 | 136 | `## Gotchas` | MOVED | PROJECT.md#gotchas | heading → anchor |
| 098 | 138 | `See `docs/ai/GOTCHAS.md`. Read in full during SHAPE and GATHER.` | MOVED | PROJECT.md#gotchas | pointer preserved; docs/ai/GOTCHAS.md LEAVE |

### Row-count check (M3 Verify)

- Numbered non-blank original lines: **98** (`grep -cvE "^[[:space:]]*$"` on snapshot = 98)
- Disposition table rows: **98**
- **EQUAL ✓**

### Disposition counts (M5 item 1)

| KEPT-VERBATIM | MOVED | MERGED | SUPERSEDED-BY | UNSORTED | DROPPED | CONFLICT-PENDING |
|---|---|---|---|---|---|---|
| 21 | 69 | 0 | 0 | 0 | 8 | 0 |

(These counts are for the CLAUDE.md snapshot only, preserving the M8 row-count invariant. The extra surfaces are accounted for separately below.)

---

## Supplementary surface dispositions (extra surfaces — kept OUT of the M3 table to preserve its 1:1 CLAUDE.md line invariant)

### RULES.md (`docs/ai/RULES.md`, 65 lines — second "master" constraints doc)

Full line-level backup preserved in `docs/ai/RULES.md.pre-migration-20260706-1720`.

| RULES.md region | content | disposition | destination |
|---|---|---|---|
| §1 Edge Proxy / Client-Server / Clerk (prose constraints) | no `middleware.ts`, service-role-key isolation, Clerk `userId` check | SUPERSEDED-BY | CLAUDE.md ## Project rows 044/045/046 (byte-equivalent laws) |
| §1 Clerk auth **code snippet** (`const { userId } = await auth(); ...`) | concrete pattern; delta over row 046 | MOVED | PROJECT.md#carried-technical-notes |
| §2 RLS Pattern A helpers | `get_my_clerk_id/profile_id`, `is_admin`, `get_my_role`; no `auth.jwt()` | SUPERSEDED-BY | CLAUDE.md ## Project row 050 |
| §2 Detail-table gating / **payments two-FK note** (L35) | `payments` two FKs to `profiles`; PostgREST join MUST use `profiles!profile_id(...)` | **MOVED** (not dropped) | PROJECT.md#carried-technical-notes |
| §2 **Supabase Cookie type note** (L36-38) | do NOT derive types from `CookieMethodsServer['setAll']` (optional); use `{ name; value; options? }` | **MOVED** (not dropped) | PROJECT.md#carried-technical-notes |
| §2 Preview-URL DB-write safety | never mutate Supabase from a Vercel Preview URL | SUPERSEDED-BY | CLAUDE.md ## Project row 048 |
| §3 390px / Layout rules / shadcn / co-location | UI standards | SUPERSEDED-BY | CLAUDE.md ## Project rows 049/053/051/052 |
| §4 **Multi-Agent Coexistence** (L59-66) | shared-state sync; read brain `implementation_plan.md`; Antigravity formats to `docs/ai/PLAN.md` layout; PR `Agent Type: Antigravity \| Claude` tag | **MOVED** (verbatim) | PROJECT.md#multi-agent-coexistence + substantive zone-2 `## Project` line (visible at SSU) |

### REFACTOR.md (`docs/ai/REFACTOR.md`, 539 lines — living refactor-findings log)

| content | disposition | destination |
|---|---|---|
| entire file (16 numbered targets, status legend, session logs, priority order) | **UNSORTED** | PROJECT-NOTES.md `## Unsorted (pre-migration docs/ai/REFACTOR.md, 2026-07-06)` — verbatim, in full, nothing summarized or dropped |

---

## CONFLICTS (M4)

**Kit-rule vs project-rule conflicts (forbid-vs-require): none found.**
Modal-word scan (`grep -inE "\b(must|never|always|don'?t|do not|only|forbidden|not)\b"`) run on the CLAUDE.md snapshot + RULES.md. Every project constraint is either a project FACT (destination `## Project`) or is compatible-and-stricter than the kit rule that owns its subject — no kit rule requires what a project rule forbids or vice-versa:
- CLAUDE.md row 043 "NEVER push to `main`; use `dev/` branches" — orthogonal to kit footer "NEVER git push unless asked" (branch policy ≠ push permission). Both retained.
- CLAUDE.md row 047 "NEVER mark Done on static analysis alone; Vercel preview READY + CI green" — stricter, project-specific DoD layered on VERIFY.md's fresh-evidence rule. Compatible; kept verbatim.
- CLAUDE.md row 054 "NEVER call create_or_update_file/push_files before CLAIM" — project workflow gate; kit CODE.md does not address pre-CLAIM writes. Compatible.
- RULES.md vs CLAUDE.md: RULES.md restates CLAUDE.md's constraints (shadcn/layout/co-location lists differ only in phrasing/examples, same intent) — no contradiction. RULES.md's unique items are additive (MOVED), not conflicting.

**CONFLICT-PENDING (1) — user-directed, self-referential, `docs/ai/system-prompt.xml`:**
The user reported an internal inconsistency in `system-prompt.xml` between two blocks describing how a Critique deviation must be anchored. On reading the committed file, the two blocks **already agree** — neither mandates a file path as the sole anchor:

- `<output_structure><Deviations>` (L125-126, verbatim):
  > "Anchor is a file path where one exists. For architectural decisions with no single locatable line, name the decision explicitly — vague categories are not acceptable."
- `<critique_mode><rules>` (L142, verbatim):
  > "Every deviation must be anchored: file path where one exists, named architectural decision otherwise. Vague categories are not acceptable."

The wording the user quoted for the `<rules>` block ("Every deviation names a file path. No file path, no deviation entry.") does **not** appear in the committed file. There is therefore no wording to reconcile as-is. **Flagged for the user at M5**: confirm whether (a) the file is already correct — close this as no-op, or (b) they intend to TIGHTEN `<rules>` to file-path-mandatory (which would then genuinely conflict with `<output_structure>` and need one side rewritten). Will NOT silently pick a wording.

`resolved: TIGHTEN + genericize (user, 2026-07-06) — DONE` — user wanted BOTH anchor blocks tightened to file-path-mandatory AND the whole prompt made project-agnostic for reuse across repos. Applied AFTER the kit-install/verify phases (snapshot `docs/ai/system-prompt.xml.pre-migration-20260706-1720`, hash `86fee986`). Changes: `<output_structure><Deviations>` (L119, L125-126) and `<critique_mode><rules>` (L142) now both mandate a concrete `file:line` ("no file path, no deviation entry"); genericized identity (removed tevd-portal/Next.js/Supabase/Clerk hard-coding → defers to CLAUDE.md), `via GitHub MCP` → `via your PR/VCS tooling`, `docs/ai/CONTEXT.md`/`REF.md` paths → "the docs CLAUDE.md points to", `Pattern A helpers` → `auth/RLS helpers`. **Tradeoff noted:** file-path-mandatory means a purely architectural deviation with no single locatable line can no longer be reported — this is the strict reading the user chose over the file-path-OR-named-decision fallback.

---

## Kit-doc collisions (M6a)

`docs/guardrails/` contained only MIGRATION-LOG.md before install — no pre-existing kit-doc-named files, so no collisions. All 8 installed cleanly (precheck = none for each), hashes verified equal to kit source at M6a and re-verified at M8(3):

- `_FORMAT.md`: installed
- `PLAN.md`: installed
- `CODE.md`: installed
- `DEBUG.md`: installed
- `VERIFY.md`: installed
- `EFFICIENCY.md`: installed
- `SESSION.md`: installed
- `TRAPS.md`: installed

---

## RULES.md deletion (post-M5, user-approved 2026-07-06)

Surface S-09 fate resolved: **DELETE** (user chose delete after being shown the live inbound references at the M9 checkpoint).

- Content preserved before deletion: `docs/guardrails/PROJECT.md#carried-technical-notes` (payments FK, Supabase cookie type, Clerk snippet), `docs/guardrails/PROJECT.md#multi-agent-coexistence` (§4), `CLAUDE.md` `## Project` Hard Constraints (duplicated laws), and snapshot `docs/ai/RULES.md.pre-migration-20260706-1720` (hash `2b03849d`).
- File deleted: `rm docs/ai/RULES.md` — confirmed gone; snapshot retained.
- **Live references fixed:**
  - `docs/ai/BUILD.md:14` — "Rely on `.cursor/rules/`, `docs/ai/RULES.md` and project architecture docs" → "Rely on `CLAUDE.md` (hard constraints), `.cursor/rules/`, `docs/guardrails/PROJECT.md` and project architecture docs".
  - `agentic.config.json` — removed the `"docs/ai/RULES.md": "3bcdfc72…"` hash entry (and the now-trailing comma on the preceding `CLAIM.md` line); re-validated as valid JSON.
  - `.infraignore` — removed the `docs/ai/RULES.md` line.
  - `docs/architecture/DECISIONS.md` — **no fix needed**: ADR-009 is `Active` and contains NO `RULES.md` reference (the `.agents/**` handoffs only *proposed* a "Superseded by RULES.md §3" link that was never applied to the committed file).
- **Historical references intentionally NOT edited** (records of past sessions; editing them rewrites history): `.agentic-upgrade-log` (2026-06-04 "ADDED docs/ai/RULES.md"), and the `.agents/**` audit/handoff/analysis/prompt files that cite RULES.md line numbers. These are inert historical logs — no runtime impact.
- Post-deletion grep for `RULES.md` (excluding snapshots, historical logs, `.agents/`, and migration provenance): **NONE remaining**.

## Post-migration kit edit — v1.0 -> v1.0.1 (2026-07-10, drag-factor review)

F15 requires a kit-file edit to bump its version comment and log an entry under `README.md ## Upgrade notes`; no `docs/guardrails/README.md` exists in this repo (never created during the v1.0 migration), so this entry substitutes as the closest existing audit-trail artifact until/unless such a README is added.

- **File changed:** `docs/guardrails/SESSION.md` — version comment bumped `v1.0` -> `v1.0.1`.
- **What:** added S8 — a silent-`ScheduleWakeup`-re-poll budget (stop after 3 consecutive silent wakeups; geometric backoff past the first). New ID, no renumbering (F12).
- **Why:** a live session ("Fable refactoring and UX improvements") was found looping `ScheduleWakeup` indefinitely at a flat cadence waiting on a deferred human decision, re-entering cold context each cycle with no new signal — pure overhead with no corresponding guardrail rule.
- **Also added this pass (non-kit, no version bump needed):** `docs/CLAIMS.md` (new claim registry) + a `docs/guardrails/PROJECT.md#claim-complete-definition` addition wiring it into CLAIM (PROJECT.md is F15-exempt, project-authored).

