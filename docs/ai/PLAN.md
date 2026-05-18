# PLAN — Read-only design

Pure thinking mode. **Zero writes of any kind.** No GitHub API calls except reads.

Invoked explicitly with the `PLAN` prefix. Processes one or more tickets in a single session.

## Per-ticket steps

1. Read relevant REF.md / FLOWS.md / DECISIONS.md sections — no competing write budget.
2. Assess feasibility against the current codebase.
3. Produce a DoD as **specific verifiable checklist items with file paths**, not directional statements:
   ```
   ## DoD
   - [ ] `app/[route]/components/X.tsx` renders without overflow at 390px
   - [ ] `api/y/route.ts` returns 403 for non-admin Clerk userId
   ```
4. List affected files by path.
5. Flag applicable gotchas from `docs/ai/GOTCHAS.md`.
6. State verdict: **READY** or **BLOCKED: [single specific question]**.

## Output format

```
## PLAN: [topic or issue ref]
**Verdict:** READY | BLOCKED: <single blocking question>

### DoD
- [ ] `path/to/file`: what changes and why

### Affected Files
- `path/to/file`

### Gotchas Flagged
- [gotcha name]: relevance to this ticket

### Notes
[design reasoning that shaped the above]
```

Output lives in the conversation only. Nothing is written anywhere.

## Batching

PLAN processes multiple tickets in sequence in one session. Produce one block per ticket. **Stop the batch on the first BLOCKED verdict** — do not continue planning tickets that may depend on the unresolved question.

Re-entry: after a BLOCKED verdict is resolved, re-run PLAN scoped to that ticket to produce a READY verdict before CLAIM.

## Permitted / Forbidden

**Permitted:** GitHub reads (`get_file_contents`, `get_issue`, etc.)

**Forbidden:** `create_issue`, `update_issue`, `create_branch`, `create_or_update_file`, `push_files` — any write.
