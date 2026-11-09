# Working procedure

How a change goes from a session to production, and why each step is there. The rules are in
`CLAUDE.md`; this file is the order. Commands, setup and troubleshooting are in
`docs/DEV_WORKFLOW.md`. A step that was missed gets added here the day it is missed.

## Start

1. **Ground truth:** `git status`, `git log --oneline -3`, then read `docs/STATE.md`. *Why:* a
   session resumes from what is on disk, not from what the last session said it did.
2. **Pick the work from a GitHub issue.** `priority:high` first, then unlabelled, then
   `priority:low`; never a `blocked` issue without the user's say-so. No issue yet: create it and
   read the number from the response. ID format and labels: `docs/guardrails/PROJECT.md`.
   *Why:* the issue number is the only ID that cannot collide.
3. **Overlap check before cutting a branch:** `gh pr list --state open --json number,title,headRefName,files`,
   `git ls-remote --heads origin 'dev/*'` and `git worktree list`. Anything touching the same
   files or area: tell the user before going on. *Why:* PR #538 and 2607-DEV-535 independently
   added a debounce to the same search input; nobody saw it until merge.
4. **One worktree per branch:** branch `dev/[YYMM]-DEV-[GH#]` off `origin/main`, then
   `npm run env:worktree` and `npm ci`. *Why:* a worktree inherits neither env file nor
   `node_modules`, and parallel sessions never touch each other's files.

## While working

- **Plan before the first edit.** `docs/guardrails/PLAN.md` (TASK block). For an issue, also
  state: the DoD as file-path-level checks, the gotchas from `docs/ai/GOTCHAS.md` that apply, and
  the migration and E2E impact (rollback path, expand/contract order, which Playwright project
  covers it: `authenticated`, `mobile-390` or none). *Why:* a directional DoD cannot be verified.
- **Read only what the change needs.** `docs/ai/REF.md` by section. Architecture by area: auth,
  role and Clerk sync `FLOWS.md §1`; registration `§2`; payments `§3`; LOS, tree and
  notifications `§4`; vital signs `§5`. A new external dependency updates `C4.md` first; a new
  architectural pattern gets an ADR in `DECISIONS.md` before code.
- **`npm run check:env` before the first command that touches hosted data** (seed script,
  migration, e2e run, `supabase` CLI, a dev server exercising a write path). Read the line for the
  command you are about to run. *Why:* a full guest-registration flow ran against production on
  2026-08-09 (#714).
- **Migrations are applied and verified on the DEV project only,** after asking the user. Each one
  carries a `-- ROLLBACK:` comment and is backward-compatible with the deployed code.
- **Large change (over ~100 lines):** commit a skeleton with `// TODO:` items first, and keep the
  PR's `## Session State` at `IN PROGRESS`. *Why:* if the context runs out, the next session starts
  from the skeleton.
- **Before the first push:** `/code-review low` on the branch diff, and fix the findings locally.
  Auth, RLS or migration changes: `/security-review` or `/code-review medium`. The push itself runs
  the fast local gate (`.githooks/pre-push`: Node version, lint, types, colours, unit tests,
  attribution). *Why:* GitHub CI skips drafts, so this machine is the draft's only check.

## Landing

1. **Push (only with the user's go-ahead) and open the PR as a draft,** title and commits prefixed
   `[YYMM-DEV-GH#]`, body with `Closes #<issue>` and a `## Session State` block. The draft PR is
   the claim other sessions see in their overlap check. *Why:* CodeRabbit (`.coderabbit.yaml`) and
   GitHub CI (`draft != true` on every job) both skip drafts, so iterating costs no review quota
   and no Actions minutes. The Vercel preview and its 390px smoke still run on every push.
2. **Before marking ready:** `npm run verify:ci` passes (a NOT RUN line is left to CI), the Vercel
   preview is READY and its 390px smoke passed. Check 390px. Auth or routing touched: confirm
   `middleware.ts` does not exist. *Why:* anything found after step 3 costs a second CI run and a
   second review.
3. **Mark the PR ready.** CI runs once and CodeRabbit reviews once. Wait for CI green and open the
   gated jobs (Authenticated E2E): a job skipped on missing secrets, or a run skipped because the PR
   was still a draft, is not green. Fix every finding in ONE batched push. A wrong
   finding gets a reply and is resolved without a code change; a skipped one gets a reply with the
   reason and stays open. Resolve a thread only after its fix is pushed. *Why:* each push triggers
   an incremental re-review, so drip-fed fixes burn quota.
4. **Before merging:** `docs/ai/REF.md` updated if schema, tables, routes or env vars changed;
   `docs/STATE.md` updates folded into this PR, never a separate cleanup PR.
5. **Merge** when CI is green, the preview is READY and every thread is resolved.

## End

- **Merged is not Done.** Production deployment READY on Vercel. If the PR had migrations, approve
  the pending `migrate-prod` run (Actions, `production` gate) and confirm it applied; never apply
  production DDL by hand or through MCP. Smoke-check `https://www.teamenjoyvd.com`, then close the
  issue. Remove the worktree and delete the branch together.
- **Not merged:** the PR's `## Session State` names the single next action, and `docs/STATE.md`
  says where the work stopped.

## Known traps

Sharp edges in the code and stack: `docs/ai/GOTCHAS.md`. Process traps go here, dated.
