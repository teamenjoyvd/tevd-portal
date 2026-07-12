# Development Workflow

The single source for the dev process: local loop → verification → PR → preview → merge. Replaces the four overlapping docs proposed in PR #544 (closed, superseded — see #545/#546/#547).

> **Rollout note:** commands marked `*` land with [#546](https://github.com/teamenjoyvd/tevd-portal/issues/546). Everything else works today.

## Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR at <http://localhost:3000> |
| `npm run verify` * | Local mirror of CI: lint → check-types → test → build, visible output |
| `npm run check:env` * | Validates `.env.local` against the required-var list from `.env.example` |
| `npm run test:mobile` * | Playwright smoke at 390×844 against the local dev server |
| `npm run test:e2e` * | Full Playwright smoke (all projects) |
| `npm run e2e:seed-clerk` | Seeds two Clerk test-instance users (member, admin) + matching local `profiles` rows — see "Authenticated E2E (Clerk)" below |
| `npm run test:e2e:auth` | Authenticated Playwright coverage of `/admin/*` role gates — requires `e2e:seed-clerk` first |
| `npm run env:worktree` * | Copies the main checkout's `.env.local` into the current git worktree |
| `npm run test` | Vitest unit tests |
| `npm run lint` / `npm run check-types` | ESLint / `tsc --noEmit` |

## Local Supabase stack (Docker)

Local dev runs against a local Supabase stack ([#547](https://github.com/teamenjoyvd/tevd-portal/issues/547)) — `npm run dev` no longer touches the production database.

**One-time setup**

1. Prereqs: [Docker Desktop](https://docs.docker.com/desktop/) running; Supabase CLI (`scoop install supabase` or `npm i -g supabase`).
2. `supabase start` — pulls images on first run (~5 min), then starts API :54321, DB :54322, Studio :54323 (ports per `supabase/config.toml`).
3. Create `.env.development.local` in the repo root (gitignored; loaded by `next dev` with **higher priority than `.env.local`**, so Clerk/Mapbox values stay inherited):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase status`>
   ```

   The local keys are the Supabase CLI's standard demo JWTs — identical on every machine, not secrets.
4. `supabase db reset` — replays the full migration chain and `supabase/seed.sql` (test profiles for each role, a sample trip, the 7 storage buckets, role grants).

**Day to day**

- `supabase start` / `supabase stop` around dev sessions; `supabase db reset` for a clean slate.
- Studio at <http://localhost:54323> to inspect data.
- Mutations, form submits, and destructive experiments are all fine — it's a disposable local DB.
- `supabase db reset` doubles as migration-replay validation: it must stay green on a fresh database. Migrations dated ≤ 2026-04-07 are no-ops (their changes are folded into the `20260315000000` baseline snapshot; prod's history has them stamped). Guards in later migrations cover objects that exist in prod but predate the chain (`settings`, `email_log`, some functions) — see the file comments tagged `#547`.
- Auth is still real Clerk (`.env.local` dev-instance keys); server DB access is `createServiceClient()` per ADR-002/ADR-011, so Supabase-side auth config is inert locally.

**Prod credentials** now serve only explicitly prod-targeted work (deploys, prod data checks). Vercel **preview URLs still hit prod** — the never-write-from-preview rule stands.

## Authenticated E2E (Clerk)

Covers the authenticated pass-through path (`proxy.ts` + role gates in `lib/supabase/guards.ts`) that the navigation-only `mobile-smoke.spec.ts` can't reach (see [#560](https://github.com/teamenjoyvd/tevd-portal/issues/560)). Runs against the local Supabase stack above, never Preview/prod — Preview hits prod Supabase, and this suite needs to write synthetic test-role `profiles` rows.

1. `supabase start` + `supabase db reset` (see above).
2. `npm run e2e:seed-clerk` — idempotently creates two Clerk test-instance users (`E2E_CLERK_MEMBER_EMAIL`/`E2E_CLERK_ADMIN_EMAIL`, default `e2e-{member,admin}-tevd-portal@example.com`) via `@clerk/backend` and upserts matching `profiles` rows locally. Refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` is `127.0.0.1`/`localhost`.
3. `npm run test:e2e:auth` — signs in as each user via `@clerk/testing`'s ticket-strategy `clerk.signIn({ emailAddress })` (no password ever generated or stored) and asserts the role-gate baseline: non-admin redirected off `/admin/*` + `403` from `/api/admin/*`; admin gets `200` on both.

CI (`e2e-authenticated` job in `ci.yml`) does the same against a fresh local Supabase stack, gated on the `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` repo secrets (the existing local dev-instance keys) — the job skips (not fails) until those are added.

## The local loop

1. `npm run dev` — keep it running; Turbopack HMR picks up edits.
2. Check your work in the browser:
   - **390px first**: devtools → device toolbar → 390 width (hard constraint: every new UI surface must render correctly at 390px), then desktop.
   - Dark mode toggle if the surface has themed styles.
3. Before pushing: `npm run verify` (mirrors what CI runs — if it's green locally, CI is green apart from environment drift).
4. Optionally `npm run test:mobile` when you touched layout.

## Branch → PR → merge

1. Every change starts from a GitHub issue. ID format `[YYMM]-DEV-[GH#]` — the issue number is canonical (see [docs/guardrails/PROJECT.md](guardrails/PROJECT.md#id-format)).
2. Branch `dev/[YYMM]-DEV-[GH#]` off `main`. **Never push to `main` directly.**
3. Register the work in [docs/CLAIMS.md](CLAIMS.md) (concurrent agents check it for scope overlap).
4. Commit prefix and PR title: `[YYMM]-DEV-[GH#] description`. PRs by agents carry a `## Session State` block.
5. Push (agents: only with an explicit user go-ahead) → PR opens → automatically:
   - **GitHub Actions**: typecheck, lint, test, build, audit ([ci.yml](../.github/workflows/ci.yml))
   - **Vercel**: preview deployment (~2 min), URL in the PR comment
   - **preview-smoke** *: Playwright 390px smoke against the preview URL once the deployment is READY — advisory (not a required check) for now
   - **CodeRabbit** review; review-bot fixes are applied via the `GCR` (General Code Review) workflow command
6. Merge only when CI is green **and** the Vercel preview is READY (never mark work Done on static analysis alone).

## Git worktrees

Agent sessions run in worktrees under `.claude/worktrees/`. Two things make them work:

- `next.config.ts` sets `turbopack.root` * so the dev server resolves the worktree as project root.
- `.env.local` is not inherited by worktrees — run `npm run env:worktree` * once per worktree (mind the fence warning above).

## Database

- Migrations live in `supabase/migrations/` and are applied from agent/CLI sessions targeting a project ref directly (Supabase MCP or `supabase` CLI) — there is no CI database job.
- Refs: dev `iymwxdewcpvpjgzewtzk` (`tevd-portal-dev`, the default link in `supabase/config.toml`), prod `ynykjpnetfwqzdnsgkkg`. Never link/push prod from a dev machine without an explicit ticket.
- Local Supabase stack (Docker): tracked in #547.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm ci` fails with `EBADPLATFORM` on Windows | Fixed by #546 (Linux native binaries moved to `optionalDependencies`). On an older checkout: `npm ci --force`. |
| `supabaseUrl is required` on `npm run dev` | `.env.local` missing (fresh clone or worktree). `npm run check:env` * to diagnose; in a worktree, `npm run env:worktree` *. |
| Build passes locally, fails on Vercel | Run `npm run build` locally (same command CI/Vercel run); check the Vercel build log linked in the PR. CI builds with placeholder env — code that requires real env at *build time* will differ. |
| Type errors in IDE but `npm run test` passes | Vitest and `tsc` use different configs — run `npm run check-types`. |
| Mobile layout broken | Devtools at 390px width; `npm run test:mobile` * catches horizontal overflow on smoke-covered routes. |
