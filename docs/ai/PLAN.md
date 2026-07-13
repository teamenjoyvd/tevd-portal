# PLAN — Read-only Design

Pure thinking mode. **Zero writes of any kind** to the codebase or GitHub.
Invoked explicitly with the `PLAN` prefix. Processes one or more tickets in a single session.

## Per-Ticket Steps

1. Read relevant `REF.md`, `FLOWS.md`, and `DECISIONS.md` sections (on demand, by section).
2. Assess feasibility against the current codebase.
3. Produce a DoD as **specific verifiable checklists with file paths**, not directional statements:
   ```markdown
   ## DoD
   - [ ] `app/[route]/components/X.tsx` renders without overflow at 390px
   - [ ] `api/y/route.ts` returns 403 for non-admin Clerk userId
   ```
4. List affected file paths and gotchas from `docs/ai/GOTCHAS.md`.
5. **Migration & test impact (mandatory):**
   - Does the ticket touch `supabase/migrations/`? If yes: state the rollback path (every new migration ships a `-- ROLLBACK:` comment) and whether the change is backward-compatible with the running app (expand/contract: additive migration first, code using it second, destructive cleanup in a later ticket — app deploy and DB push happen at different moments).
   - State which Playwright project covers the change: `authenticated`, `mobile-390`, or none — with a one-line reason.
6. State verdict: **READY** or **BLOCKED: [single specific blocking question]**.

## Output Format
Output must be printed in the chat conversation.

```markdown
## PLAN: [topic or issue ref]
**Verdict:** READY | BLOCKED: <single blocking question>

### DoD
- [ ] `path/to/file`: what changes and why

### Affected Files
- `path/to/file`

### Gotchas Flagged
- [gotcha name]: relevance to this ticket

### Migration & Test Impact
- Migration: yes (rollback: <path>; expand/contract: <ok | sequencing note>) | no
- E2E coverage: authenticated | mobile-390 | none — <reason>

### Notes
[design reasoning that shaped the above]
```

## Batching & Rules
- Process multiple tickets sequentially. **Stop the batch immediately on the first BLOCKED verdict** — do not continue planning tickets that may depend on the unresolved question.
- **Re-entry:** After a BLOCKED verdict is resolved, re-run PLAN scoped to that ticket to produce a READY verdict before CLAIM.
- **Permitted:** Reads only (`get_file_contents`, `get_issue`, `list_pull_requests`, etc.).
- **Forbidden:** Any mutative operations (`create_issue`, `update_issue`, `create_branch`, `create_or_update_file`, `push_files`, etc.).
