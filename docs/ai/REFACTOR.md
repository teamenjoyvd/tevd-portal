# Full-Scope Review & Refactor Procedure

> **tevd-portal** — gemini-3.1-pro-preview · Claude Opus 4.6 · Claude Sonnet  
> Goals: tech debt reduction · security hardening · file decomposition · code cleanliness

---

## Core Constraint

Review and refactor are **strict phases**. Phases 1–3 produce zero file writes. Phase 4–5 execute against the complete picture produced by Phase 3. Never interleave audit and execution.

---

## Model Role Assignment

| Model | Role | Scope |
|---|---|---|
| `gemini-3.1-pro-preview` | All four audit sessions | READ ONLY — zero writes |
| Claude Opus 4.6 | Triage · ticket authoring · all BUILD sessions requiring judgment | TRIAGE + BUILD |
| Claude Sonnet | High-volume mechanical BUILD execution (i18n sweeps, dead code removal, rename passes) | BUILD — low ambiguity only |

**Gemini prompting rule:** `thinking_level` defaults to `high` — do not override it. Keep prompts concise and direct. Gemini 3.1 Pro degrades on verbose chain-of-thought scaffolding. Place the codebase pack at the top, instructions at the end, starting with "Based on the codebase above...".

---

## Prerequisites

Verify all items before generating the pack. Skipping any introduces noise or risk.

- [ ] `i18n` chore fully merged to `main` — pack generated before merge will have i18n finding noise
- [ ] Clean `main` pull confirmed — `git pull origin main && git status` → no uncommitted changes
- [ ] `_audit/` added to `.gitignore` before the directory is created
- [ ] Repomix available — `npx repomix --version`
- [ ] GitHub labels created (see Phase 4)
- [ ] GitHub "Refactor" milestone created

---

## Phase 1 — Pack Generation

Run once from repo root on clean `main`. This snapshot is the ground truth for all subsequent work.

### Generate the pack

```bash
mkdir -p _audit
npx repomix \
  --ignore "node_modules,.next,coverage,**/*.test.*,**/*.spec.*,*.lock,public,_audit" \
  --output _audit/repomix-full.txt \
  .
```

### Size check — do this before sending to Gemini

```bash
wc -c _audit/repomix-full.txt
```

| Pack size | Action |
|---|---|
| Under ~3.5M characters | Proceed with single pack — `gemini-3.1-pro-preview` handles it in one session |
| Over ~3.5M characters | Split by domain (see below) — unlikely for tevd-portal but verify |

### Domain split (only if pack exceeds limit)

```bash
npx repomix --include "app/**,middleware.ts" --output _audit/pack-app.txt .
npx repomix --include "components/**"        --output _audit/pack-components.txt .
npx repomix --include "lib/**,types/**"      --output _audit/pack-lib.txt .
npx repomix --include "supabase/**"          --output _audit/pack-supabase.txt .
```

### Record snapshot hash

```bash
git rev-parse HEAD > _audit/snapshot.txt
```

This hash is used in Phase 5 to detect drift before every BUILD session.

> **Immutability rule:** Once the pack is generated and the hash recorded, do not merge any branches or commit any changes until Phase 5 execution begins. Audit findings are tied to this snapshot.

---

## Phase 2 — Gemini 3.1 Pro Audit (Four Sessions)

Four separate Gemini sessions, one focused lens each. Never combine lenses — mixed prompts produce shallow, averaged findings. Save every output before closing the session.

### Session A — Security & Authentication

Save output as: `_audit/raw-security.md`

```
[Paste repomix-full.txt content here]

Based on the codebase above, audit for security vulnerabilities and authentication gaps only.

Focus on:
- Clerk: missing auth guards, wrong session validation, token misuse, middleware gaps, public routes that should be protected
- Supabase RLS: tables without policies, logical gaps in policies, anon key misuse, service role key exposed or used client-side
- Server actions / API routes: missing auth checks, IDOR vectors, missing input validation
- Environment variables: secrets referenced client-side, missing server-side validation
- Edge functions: auth bypass, SSRF, unsafe fetch targets

Output one block per finding, exactly:
ID: SEC-[NNN]
SEVERITY: critical | high | medium | low
FILE: <path>
LINE: <line number or range>
ISSUE: <one sentence>
FIX: <one sentence or minimal code>
---

Rules: only findings with a clear correct answer. If a pattern appears intentional but is still wrong, add "(appears intentional)" to ISSUE. No style opinions.
```

---

### Session B — Architecture & Tech Debt

Save output as: `_audit/raw-arch.md`

```
[Paste repomix-full.txt content here]

Based on the codebase above, audit for architectural problems and tech debt only.

Focus on:
- RSC vs client boundary: 'use client' on components that don't need it, data fetching in wrong layer
- Data fetching: N+1 patterns, redundant fetches, missing caching, waterfall chains that could be parallelised
- Component structure: god components, missing decomposition, prop drilling that should be server-passed
- Type safety: `any` usage, missing generics, runtime shapes mismatched to TypeScript types
- Dead code: unused exports, unreachable branches, commented-out blocks, imports with no references
- Duplication: logic in 2+ places that should be extracted to a shared module

Output format: ID: ARCH-[NNN], same fields as Session A (SEVERITY / FILE / LINE / ISSUE / FIX / ---).
```

---

### Session C — File Size & Decomposition

Save output as: `_audit/raw-size.md`

> **Critical sequencing input:** The `INTERSECTS-WITH` field in this session's output directly controls ticket ordering in Phase 3. A file that intersects with a security finding cannot be decomposed until that security fix is committed.

```
[Paste repomix-full.txt content here]

Based on the codebase above, find every file over 200 lines and audit for decomposition.

For each file over 200 lines produce a finding. For files over 400 lines, severity is critical regardless of other factors.

For each finding identify:
- Why the file is large: mixed concerns, missing decomposition, copy-paste, or legitimately complex domain
- The correct decomposition: specific named sub-components or modules with their single responsibility stated
- Which files across the repo import from this file (affected imports)
- Whether any finding from the security or architecture audit targets this same file — list those finding IDs as INTERSECTS-WITH

Output format:
ID: SIZE-[NNN]
SEVERITY: critical (400+ lines) | high (300-399) | medium (200-299)
FILE: <path>
LINES: <line count>
REASON-LARGE: <one sentence>
DECOMPOSITION: <named pieces with single responsibility each>
AFFECTED-IMPORTS: <list of files that import this>
INTERSECTS-WITH: <SEC/ARCH finding IDs, or "none">
---
```

---

### Session D — i18n & Consistency

Save output as: `_audit/raw-i18n.md`

```
[Paste repomix-full.txt content here]

Based on the codebase above, audit for i18n violations and code consistency problems only.

Focus on:
- Literal strings not wrapped in t() — flag file and line number
- Inconsistent naming: components, files, hooks, types not following the same convention within their category
- Mixed patterns for the same problem: multiple toast systems, multiple fetch wrappers, multiple error handling approaches
- Missing or inconsistent error boundary coverage

Output format: ID: I18N-[NNN], same fields as Session A (SEVERITY / FILE / LINE / ISSUE / FIX / ---).
```

---

## Phase 3 — Opus Triage

Single Opus session. Feed all four raw files plus the constraint sections from `CLAUDE.md` (Zero-Refactor Rule, commit convention, branch naming, hard constraints). This session produces the complete executable plan. Zero file writes.

```
[Paste all four raw audit files here, then CLAUDE.md constraint sections]

Triage these audit findings into an executable refactor plan.

Produce a triage document with exactly this structure:

## 1. Duplicates Removed
Finding pairs describing the same root issue. State which ID is kept and why.

## 2. Sequencing Constraints
Mandatory ordering rules. Format: "[ID] must precede [ID] because [reason]"

Enforce these hard rules:
- All SEC findings execute before any ARCH or SIZE finding in the same file
- SIZE decomposition of a file executes after all targeted fixes inside that file are committed — never before
- ARCH fixes that change a module public API execute before SIZE splits of that module

## 3. Clustered Ticket List
Group findings into tickets. Each ticket must:
- Be executable in one BUILD session
- Touch one domain (no mixing security fixes with component splits)
- Contain 3–7 files maximum
- Have one clear acceptance criterion

Per ticket:
TICKET: REFACTOR-[NNN]
LABEL: security | arch | debt | i18n | decomposition
PRIORITY: 1 | 2 | 3
FILES: <list>
FINDINGS: <finding IDs>
ACCEPTANCE: <what done looks like, one sentence>
BLOCKED-BY: <TICKET-ID or none>
ASSIGNED-TO: opus | sonnet
```

**Assignment rule:** security, architecture, and all decomposition tickets → Opus. i18n, dead code removal, rename consistency → Sonnet.

Save output as `_audit/triage.md`.

---

## Phase 4 — GitHub Issue Creation

One GitHub issue per ticket from `_audit/triage.md`. Create in priority order (P1 first) so issue numbers reflect execution sequence.

### Labels to create before issue creation

| Label | Usage |
|---|---|
| `refactor:security` | Auth gaps, RLS, secrets, Clerk misuse |
| `refactor:arch` | RSC boundaries, data fetching layer, type safety, duplication |
| `refactor:debt` | Dead code, consistency, mixed patterns |
| `refactor:i18n` | Literal strings, translation coverage |
| `refactor:decomposition` | File splits, component extraction |
| `refactor:stale` | Applied to findings invalidated by drift — issue closed without execution |

### Milestone

Create a **"Refactor"** milestone in GitHub before creating any issues. Assign every refactor ticket to it. The milestone progress bar is the single source of truth for refactor progress.

### Issue body template

```markdown
## Summary
[One sentence: what this fixes and why it matters]

## Context
Audit snapshot: [hash from _audit/snapshot.txt]
Audit sessions: [which of SEC / ARCH / SIZE / I18N contributed findings]

## Findings
[Paste the exact finding blocks from raw audit files]

## Files in Scope
- `path/to/file.tsx`

## Acceptance Criteria
- [ ] [Specific verifiable criterion from triage ACCEPTANCE field]
- [ ] No new TypeScript errors
- [ ] No new lint errors
- [ ] Vercel deployment READY

## Blocked By
#[issue number] or "none"

## Design Checklist
- [ ] Approach confirmed before any file writes
- [ ] No files outside scope touched
- [ ] Zero-Refactor Rule respected
- [ ] Commit format: `[REFACTOR-NNN] scope: description`
```

---

## Phase 5 — BUILD Execution

### Mandatory drift check — before every BUILD session

```bash
# Compare current HEAD to audit snapshot
git diff $(cat _audit/snapshot.txt) HEAD --name-only
```

| Drift result | Action |
|---|---|
| Files in ticket scope appear in diff | Re-read current file state. Verify finding still applies. If stale: close issue with label `refactor:stale`, comment explaining what changed. |
| Files outside ticket scope appear in diff | Proceed. Out-of-scope drift does not affect this ticket. |
| No diff | Proceed normally. |

### Decomposition tickets — extra pre-flight

Before splitting any file, confirm all consumers of that file's exports are within the declared scope:

```bash
grep -r "from.*path/to/file" --include="*.tsx" --include="*.ts" .
```

An unexpected consumer outside scope means the ticket needs a scope amendment before proceeding — not a mid-session expansion.

### Sequencing is binding

The `BLOCKED-BY` chain from `_audit/triage.md` is not a suggestion. Security tickets execute before all others, always. Do not reorder to pick easier tickets first.

### Branch and commit convention

| Item | Format |
|---|---|
| Branch name | `refactor/REFACTOR-NNN-short-description` |
| Commit message | `[REFACTOR-NNN] scope: description` |
| PR title | `[REFACTOR-NNN] scope: description` |

### Definition of done — per ticket

- All acceptance criteria checked in the GitHub issue
- No new TypeScript errors (`tsc --noEmit` passes)
- No new lint errors
- Remote commit exists on the branch
- Vercel deployment shows READY
- Issue closed and linked PR merged

---

## Quick Reference

### Audit output file map

| File | Contents |
|---|---|
| `_audit/repomix-full.txt` | Full repo pack — ground truth for all Gemini sessions |
| `_audit/snapshot.txt` | Git commit hash at pack generation time |
| `_audit/raw-security.md` | Gemini Session A output |
| `_audit/raw-arch.md` | Gemini Session B output |
| `_audit/raw-size.md` | Gemini Session C output |
| `_audit/raw-i18n.md` | Gemini Session D output |
| `_audit/triage.md` | Opus triage output — source of all GitHub issues |

### Finding ID prefix map

| Prefix | Source |
|---|---|
| `SEC-NNN` | Session A — Security |
| `ARCH-NNN` | Session B — Architecture |
| `SIZE-NNN` | Session C — File size |
| `I18N-NNN` | Session D — i18n & consistency |
| `REFACTOR-NNN` | Triage cluster ticket ID |

### Execution order

| Order | Rule |
|---|---|
| 1st | All P1 security tickets (`refactor:security`), sorted by `BLOCKED-BY` chain |
| 2nd | All P1 architecture tickets, sorted by `BLOCKED-BY` chain |
| 3rd | P2 debt and i18n tickets |
| Last | All decomposition tickets — only after targeted fixes in each file are committed |

---

## Ticket Proposals (Structural)

These are structural shapes based on what a codebase of this type and scale typically produces. Actual finding IDs, files, and scope are populated from `_audit/triage.md` after the Gemini audit runs.

> After Phase 3 (Opus triage) is complete, replace placeholder content below with real findings from `_audit/triage.md`. Create GitHub issues in the order shown. `REFACTOR-NNN` IDs are placeholders — use sequential IDs from triage.

---

### REFACTOR-001 · `refactor:security` · P1 · Opus

**Clerk auth guards across all protected routes**

Clerk middleware and per-route auth checks may be missing or incorrectly configured. Covers all auth guard gaps from Session A.

Files: `middleware.ts` / `proxy.ts`, `app/(dashboard)/layout.tsx`, `app/api/**/route.ts`, `lib/auth/*.ts`

Acceptance: All protected routes return 401/redirect for unauthenticated requests. No route accessible without a valid Clerk session unless explicitly marked public.

Blocked by: none

---

### REFACTOR-002 · `refactor:security` · P1 · Opus

**Supabase RLS — close policy gaps and anon key misuse**

Tables may have missing or logically flawed RLS policies. Service role key may be used where user auth context is required.

Files: `supabase/migrations/*.sql`, `lib/supabase/*.ts`, `lib/server/*.ts`

Acceptance: Every table with user data has an RLS policy. Service role key not used in any client-side or edge context. Anon key limited to genuinely public operations.

Blocked by: REFACTOR-001

---

### REFACTOR-003 · `refactor:security` · P1 · Opus

**Server actions and API routes — input validation and auth checks**

Server actions and route handlers may accept inputs without validation or execute without verifying session state.

Files: `app/api/**/route.ts`, `app/**/actions.ts`, `lib/actions/*.ts`

Acceptance: Every server action verifies auth before executing. All inputs validated at the server boundary. No IDOR vector — resource ownership verified before mutation.

Blocked by: REFACTOR-001

---

### REFACTOR-004 · `refactor:arch` · P1 · Opus

**RSC vs client boundary corrections — batch 1**

`'use client'` on components with no client-side behaviour. Data fetching in client components that should be RSC.

Files: `[affected batch 1 from ARCH findings]`

Acceptance: No `'use client'` on a component with no client-side behaviour. Data fetching moved to RSC layer for affected files. No regression.

Blocked by: REFACTOR-002

---

### REFACTOR-005 · `refactor:arch` · P2 · Opus

**Extract duplicated logic to shared modules**

Business logic, fetch wrappers, or utilities duplicated across 2+ files.

Files: `lib/[new-shared-module].ts`, affected consumers

Acceptance: Duplicated logic exists in exactly one place. All consumers updated. No behaviour change — extraction only.

Blocked by: REFACTOR-004

---

### REFACTOR-006 · `refactor:arch` · P2 · Opus

**Eliminate `any` types and missing generics — batch 1**

Files: `types/*.ts`, `lib/*.ts`, affected components

Acceptance: No `any` in files in scope. Runtime shapes match TypeScript types at all boundaries.

Blocked by: REFACTOR-004

---

### REFACTOR-007 · `refactor:debt` · P2 · Sonnet

**Remove dead code — unused exports, unreachable branches, commented blocks**

Files: `[files from ARCH dead code findings]`

Acceptance: No unused exports, no commented-out blocks, no unreachable branches in files in scope.

Blocked by: REFACTOR-005

---

### REFACTOR-008 · `refactor:i18n` · P2 · Sonnet

**Wrap remaining literal strings — batch 1**

Literal strings not wrapped in `t()` found by Session D.

Files: `[batch 1 from I18N findings]`

Acceptance: No `i18next/no-literal-string` lint warnings in files in scope. All new keys added to BG and EN locale files.

Blocked by: REFACTOR-005

---

### REFACTOR-009 · `refactor:decomposition` · P3 · Opus

**Decompose oversized components — batch 1 (400+ lines)**

Critical SIZE files with no unresolved intersecting security or architecture findings.

Files: `[critical SIZE files with no open intersecting tickets]`

Acceptance: Each extracted sub-component has a single stated responsibility. All consumers updated. No behaviour change. `grep` confirms no remaining imports from original path outside scope.

Blocked by: REFACTOR-007

---

### REFACTOR-010 · `refactor:decomposition` · P3 · Opus

**Decompose oversized components — batch 2 (200–399 lines)**

High/medium SIZE files after all targeted fixes merged.

Files: `[high/medium SIZE files]`

Acceptance: Same as REFACTOR-009.

Blocked by: REFACTOR-009

---

*Populate findings from `_audit/triage.md` before creating GitHub issues.*
