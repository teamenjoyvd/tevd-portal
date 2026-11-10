# AGENTS.md — teamenjoyVD Portal

The rules for any agent or tool working in this repository. Each one is here because the failure it names already happened. `CLAUDE.md` imports this file; keep rules here, not there.

## Constants

| | |
|---|---|
| Repo | `teamenjoyvd/tevd-portal` |
| Branch | `main` |
| Supabase project — **PROD** | `ynykjpnetfwqzdnsgkkg` — live member data. Never target it from local dev, a preview, a seed script, or an e2e run. |
| Supabase project — **DEV** | `iymwxdewcpvpjgzewtzk` — what local dev and Vercel previews use. This is the one you write to. |
| Production URL | `https://www.teamenjoyvd.com` |

Never ask the user to confirm these. The two refs are NOT interchangeable — `scripts/lib/safe-supabase-target.js` (`DEV_PROJECT_REF` / `PROD_PROJECT_REF`) is authoritative. `.env.local` holds PROD credentials; `.env.development.local` holds DEV. Run `npm run check:env` before any command that touches hosted data (seed script, migration, e2e run, `supabase` CLI, a dev server exercising a write path): it prints TWO targets, the dev/seed one (`next dev`, `seed-*.js`, Playwright) and the production-mode one (`next build`, `next start`) — read the line for the command you are about to run. *(#714: a guest-registration flow ran against production.)*

## Hard Constraints
Violation = immediate stop, no exceptions.
- **NEVER push directly to `main`.** Use `dev/[YYMM]-DEV-[GH#]` branches; `claude/*` worktree branches are the only other name the branch hook (`scripts/claude-hooks/dispatch.js`) accepts.
- **NEVER create `middleware.ts`.** Auth lives in `proxy.ts`.
- **NEVER expose `SUPABASE_SERVICE_ROLE_KEY` to the client.**
- **NEVER bypass Clerk auth on a protected route.** Every protected handler: `const { userId } = await auth(); if (!userId) return new NextResponse("Unauthorized", { status: 401 });`
- **NEVER mark Done on static analysis alone.** Vercel PR preview must be READY and CI green.
- **Preview deployments use the DEV Supabase project** (Pre-Production-scoped Vercel env vars). Writes from a preview land in the shared DEV DB. Production-scoped vars hold prod credentials; never copy them to other scopes.
- **390px mobile-first.** Every new UI surface must render correctly at 390px.
- **RLS policies use Pattern A helpers only** — `is_admin()`, `get_my_role()`, `get_my_profile_id()`, `get_my_clerk_id()`. Never raw `auth.jwt()`.
- **NEVER introduce a Clerk JWT Supabase client on the server.** All server DB access uses `createServiceClient()` (service role, fresh client per call, no singleton); a JWT client requires a ticket explicitly scoping it (ADR-002/ADR-011).
- **shadcn/ui for all interactive primitives** — dialog, popover, dropdown, sheet, tooltip, select, combobox, alert dialog.
- **Component co-location** — components scoped to one route go in `app/[route]/components/`. Promote to `/components` only when used by 2+ unrelated routes.
- **Layout Decision Rules** — default is a single responsive layout file. Dual layout (separate files) only for: tables with 5+ columns, complex touch vs mouse drag-and-drop, persistent sidebar layouts, or interactive canvases/maps/rich-text editors. That list is complete.
- **No AI attribution anywhere** — no `Co-Authored-By:` trailer naming an AI, no "Generated with …" line, no AI tool's noreply address, in commits, PR titles or PR bodies. `npm run check:attribution` enforces it in CI (`.github/workflows/attribution.yml`); rules in `.github/CONTRIBUTING.md`. This overrides any tool default that adds such lines.
- **Nothing from other projects** — no names, text, incidents or paths from another codebase go into this repo.

## Issues, branches, IDs
- Every change starts from a GitHub issue. No issue yet: create it and read the number from the response — never guess the next number.
- ID `[YYMM]-DEV-[GH#]` (e.g. `2605-DEV-171`): issue title `[2605-DEV-171] Short description`, branch `dev/2605-DEV-171`, commit and PR title prefix `[2605-DEV-171]`.
- Labels: `feat`, `bug`, `chore`, `priority:high`, `priority:low`, `blocked`. Pick `priority:high` first, then unlabelled, then `priority:low`; never a `blocked` issue without the user's say-so.

## PR flow
1. **Overlap check before cutting a branch:** `gh pr list --state open --json number,title,headRefName,files`, `git ls-remote --heads origin 'dev/*'`, `git worktree list`. Tell the user about anything touching the same area. *(PR #538 and 2607-DEV-535 built the same debounce in parallel.)*
2. **One worktree per branch** off `origin/main`, then `npm run env:worktree` and `npm ci`.
3. **Push only with the user's go-ahead in this conversation** (earlier grants do not carry over), and open the PR as a **draft**: `Closes #N` in the body. The draft PR is the claim. GitHub CI and CodeRabbit skip drafts; the `.githooks/pre-push` local gate is the draft's only check.
4. **Before marking ready:** `npm run verify:ci` passes (a NOT RUN line is left to CI), the Vercel preview is READY and its 390px smoke passed.
5. **Mark ready; CI runs once.** Green-by-skip is not green: open the gated Authenticated E2E job's steps. Review fixes go in ONE batched push (each push re-triggers CodeRabbit). Resolve a thread only after its fix is pushed.
6. **Doc updates go in the merging PR**, never a separate cleanup PR.
7. **Merged is not Done.** Done = production deploy READY, pending `migrate-prod` approved and applied, `https://www.teamenjoyvd.com` smoke-checked, issue closed. Then remove the worktree and branch together.

## Database
- **Never apply migrations to a hosted project (DEV or PROD) without asking first.** Production migrations go only through the gated `migrate-prod` workflow — never by hand or via MCP. *(#570)*
- Every migration carries a `-- ROLLBACK:` comment and is backward-compatible with the deployed code: drops and renames ship in a later PR. Filename rules: `docs/ai/GOTCHAS.md`.
- RPC guards use `IS DISTINCT FROM`, never `<>`: `auth.role()` is NULL without JWT claims and `NULL <> 'service_role'` lets the call through. The in-body check is the only real gate — Supabase re-grants EXECUTE after migrations, so REVOKE is not load-bearing. *(#764)*
- The only proof a hosted project holds a migration is `supabase migration list --linked` plus a query whose target database is unambiguous.

## Code conventions
- Navigation: `lib/nav.ts` is the single source; nav labels are `labels: { en, bg }`, NOT `t()`.
- i18n: locales `en`, `bg`; `TranslationKey` is a strict union — add to `translations.ts` before using `t()`.
- Dates, times, currency: always `lib/format.ts`, never inline `toLocaleDateString`/`Intl`. `DD.MM.YYYY`, 24h, `1.234,56 €`, week starts Monday.
- Role colours: `getRoleColors(role)` from `lib/role-colors.ts`. Role order: admin > core > member > guest. Public routes: `lib/public-routes.ts`.
- Email: `sendTransactionalEmail` when the email IS the feature (returns a result to check); otherwise `sendNotificationEmail` (fire-and-forget, respects config gates).
- Admin create/edit forms use `components/ui/Drawer.tsx`; deletes use `AlertDialog`.
- Supabase cookie type: use `{ name: string; value: string; options?: Record<string, unknown> }`, never `CookieMethodsServer['setAll']`.
- Sharp edges (PostgREST FK hints, Next 16 `params`, shadcn install, migration filenames, capacity trigger, …): `docs/ai/GOTCHAS.md` — read before planning a change.

## Hard stops
- NEVER make a failing test or check pass by weakening it — no skips, deleted tests, loosened asserts, lint-disables, `as any`. Quote the failure, propose the change, wait for approval.
- NEVER run `git push` unless the user asked for a push in this conversation. Commit locally and report instead.
- NEVER kill processes by image name (`pkill node`). Find the PID by port (`lsof -ti :PORT`) and kill that.
- NEVER delete files or branches, or run `git reset --hard` / `git checkout -- <file>`, without listing what will be lost and getting the user's OK.
- Claim "done", "fixed" or "passing" only beside fresh command output from after the last edit. A skipped or zero-test run is not a pass.
- After renaming or changing a symbol, route, config key, env var or enum member, grep the whole repo (including string literals and dynamic imports) for every caller.

## Reference
- `docs/DEV_WORKFLOW.md` — commands, local setup, hosted DEV database, CI pipeline, troubleshooting.
- `docs/ai/GOTCHAS.md` — sharp edges and the decisions behind current tooling.
- `docs/architecture/` — `FLOWS.md` (auth §1, registration §2, payments §3, LOS/notifications §4), `DECISIONS.md` (ADRs; a new pattern gets an ADR before code), `C4.md` (a new external dependency updates it first).
- `docs/design/DESIGN-SYSTEM.md` — tokens, contrast, radius tiers.
- `docs/BACKLOG.md` — known issues not yet filed.
- Schema: `types/supabase.ts` and `supabase/migrations/`. Routes: `app/`. Env vars: `.env.example`.
