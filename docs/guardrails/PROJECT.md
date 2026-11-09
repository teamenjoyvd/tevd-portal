# PROJECT.md — teamenjoyVD Portal (migrated project content)

Project-authored archive. Content transported verbatim from the pre-migration `CLAUDE.md` and `docs/ai/RULES.md` during the guardrails-kit v1.0 migration (2026-07-06). Exempt from `docs/guardrails/_FORMAT.md` doc-shape rules. `CLAUDE.md` `## Project` points here. The former `## Workflow commands` (SSU / PLAN / CLAIM / BUILD / GCR) and `## CLAIM-Complete Definition` sections were retired on 2026-11-09; the order of work now lives in `docs/working-procedure.md`, and the retired docs are in `docs/archive/workflow-phases-2026-11/`.

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

## Gotchas

See `docs/ai/GOTCHAS.md`. Read in full before planning a change.

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
