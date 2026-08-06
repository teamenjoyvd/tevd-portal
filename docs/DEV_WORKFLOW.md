# Development Workflow

The single source for the dev process: local loop → verification → PR → preview → merge. Replaces the four overlapping docs proposed in PR #544 (closed, superseded — see #545/#546/#547; all landed).

## Command reference

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR at <http://localhost:3000> |
| `npm run verify` | Local mirror of CI: lint → check-types → test → build, visible output |
| `npm run check:env` | Validates env vars against `.env.example`'s required list; classifies the Supabase target as LOCAL/DEV/other |
| `npm run test:mobile` | Playwright smoke at 390×844 against the local dev server |
| `npm run test:e2e` | Full Playwright smoke (all projects) |
| `npm run e2e:seed-clerk` | Seeds two Clerk test-instance users (member, admin) + matching local `profiles` rows — see "Authenticated E2E (Clerk)" below |
| `npm run test:e2e:auth` | Authenticated Playwright coverage of `/admin/*` role gates — requires `e2e:seed-clerk` first |
| `npm run env:worktree` | Copies the main checkout's `.env.local` and `.env.development.local` into the current git worktree |
| `npm run test` | Vitest unit tests |
| `npm run lint` / `npm run check-types` | ESLint / `tsc --noEmit` |

## Hosted dev database

Local dev runs against the **hosted Supabase dev project** `iymwxdewcpvpjgzewtzk` (`tevd-portal-dev`, the default link in `supabase/config.toml`) — [#563](https://github.com/teamenjoyvd/tevd-portal/issues/563) replaced the local Docker stack ([#547](https://github.com/teamenjoyvd/tevd-portal/issues/547)) because it outgrew what a laptop-class dev box can comfortably run (several GB of container images, `npm ci` alone took 30-40 min with Docker Desktop competing for resources). Everything except the database stays local: the Next dev server, tests, tooling.

**One-time setup**

1. Supabase CLI (`scoop install supabase` or `npm i -g supabase`), logged in (`supabase login`) with access to the `tevd-portal-dev` project.
2. Create `.env.development.local` in the repo root (gitignored; loaded by `next dev` with **higher priority than `.env.local`**, so Clerk values stay inherited):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://iymwxdewcpvpjgzewtzk.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase projects api-keys --project-ref iymwxdewcpvpjgzewtzk`>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key from the same command>
   ```

   These are **real credentials** for a shared project — gitignored, never committed, never client-exposed. Unlike the old local demo JWTs, treat them like any other secret.
3. Schema should already be current (any agent session keeps it in sync via `supabase link --project-ref iymwxdewcpvpjgzewtzk` + `supabase db push`). To verify: `supabase migration list` — every row's `local` and `remote` columns should match.
4. Seed data (4 role profiles, a sample trip, the 7 storage buckets) should already be present — check via Studio or a quick `select count(*) from profiles;`. If genuinely empty, apply `supabase/seed.sql` by hand (it's idempotent, guarded with `ON CONFLICT`/`WHERE NOT EXISTS`).

**Day to day**

- No `supabase start`/`stop` — the DEV project is always up.
- Studio: <https://supabase.com/dashboard/project/iymwxdewcpvpjgzewtzk> to inspect data.
- Mutations, form submits, and normal test data are fine — but this is a **shared, mutable DB**: every machine and every agent session hits the same rows, unlike the old per-machine disposable local stack. Don't assume a clean slate; don't rely on data another session added still being there.
- `supabase db reset --linked` wipes and replays the whole dev project (schema + seed) — acceptable here, **never** for prod. Known gotcha applying migrations to a fresh Supabase Cloud project: see `docs/ai/GOTCHAS.md` (`supabase db push`/`reset --linked` row) — a `SET SESSION ROLE` mid-session doesn't pick up that role's configured `search_path`, so `uuid_generate_v4()` calls can fail until `ALTER DATABASE postgres SET search_path TO "$user", public, extensions;` is run once per project.
- Auth is still real Clerk (`.env.local` dev-instance keys); server DB access is `createServiceClient()` per ADR-002/ADR-011, so Supabase-side auth config is inert.
- `npm run e2e:seed-clerk` works against the DEV project (or a local instance) — its safety guard accepts both, see "Authenticated E2E (Clerk)" below.

**Local stack decommission** (optional, reclaims disk): `supabase stop` to tear down the Docker containers, then `docker system prune -a --volumes` to reclaim images/volumes — **destructive to all unused Docker data on the machine**, run it yourself, don't script it into anything automated.

**Prod credentials** serve only explicitly prod-targeted work (deploys, prod data checks). Vercel **preview deployments hit the DEV project** since 2026-07-16 (Pre-Production-scoped env vars in the Vercel dashboard hold the `iymwxdewcpvpjgzewtzk` URL + keys); preview writes land in the shared DEV DB. Only the Production environment carries prod credentials.

## Authenticated E2E (Clerk)

Covers the authenticated pass-through path (`proxy.ts` + role gates in `lib/supabase/guards.ts`) that the navigation-only `mobile-smoke.spec.ts` can't reach (see [#560](https://github.com/teamenjoyvd/tevd-portal/issues/560)). Runs against the hosted **DEV** project by default (or a local instance) — never Preview/prod. `scripts/seed-clerk-test-users.js` only accepts `NEXT_PUBLIC_SUPABASE_URL` pointing at `127.0.0.1`/`localhost` or the DEV project ref (`iymwxdewcpvpjgzewtzk`); it refuses everything else, including prod.

1. `.env.development.local` pointed at the hosted DEV project (the day-to-day default per this doc's "Hosted dev database" section above) — no separate setup needed.
2. `npm run e2e:seed-clerk` — idempotently creates two Clerk test-instance users (`E2E_CLERK_MEMBER_EMAIL`/`E2E_CLERK_ADMIN_EMAIL`, default `e2e-{member,admin}-tevd-portal@example.com`) via `@clerk/backend` and upserts matching `profiles` rows. It also seeds the on-behalf fixture `e2e/payments-on-behalf.spec.ts` needs to run rather than self-skip: a downline profile (`clerk_id = seed_e2e_downline_tevd_portal`, `abo_number` from `E2E_CLERK_DOWNLINE_ABO`, default `E2E-DOWNLINE-0001`) with a `tree_nodes` row under the member, and one active `payable_items` row titled **E2E Test Fee**. These land in the **shared** DEV database like any other write from this workflow — synthetic and easy to spot, but not private to your session, and the payable item *is* visible to everyone else's payment drawer on DEV. The member's own tree node is only planted when it has none, so re-running never reparents an existing LOS position.
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
   - **preview-smoke**: Playwright 390px smoke against the preview URL once the deployment is READY — advisory (not a required check) for now. Covers navigation over the public routes plus one real guest flow (`e2e/library-guide.spec.ts`: open `/library` → click a guide card → detail page). That flow needs a stable guest-visible guide in DEV (`npm run seed:smoke-guide`, seeded once — see the Database section); the spec skips with a pointer when the guide is absent, so an unseeded DB never fails the run.
   - **CodeRabbit** review; review-bot fixes are applied via the `GCR` (General Code Review) workflow command
6. Merge only when CI is green **and** the Vercel preview is READY (never mark work Done on static analysis alone).

## Git worktrees

Agent sessions run in worktrees under `.claude/worktrees/`. Two things make them work:

- `next.config.ts` sets `turbopack.root` so the dev server resolves the worktree as project root.
- `.env.local` and `.env.development.local` are not inherited by worktrees — run `npm run env:worktree` once per worktree to copy both from the main checkout.

Worktrees, branches, and scratch files accumulate fast — run the weekly hygiene pass (`npm run clean:weekly`, see `docs/WEEKLY_CLEANUP.md`).

## Database

- Migrations live in `supabase/migrations/`. **DEV**: applied from agent/CLI sessions via `supabase db push` (CLI is the single `schema_migrations` ledger writer — MCP `apply_migration` on DEV must be reconciled with `supabase migration repair --status applied` before the next push). **PR**: `migrations-check.yml` replays all migrations from scratch on a disposable local Supabase whenever `supabase/**` changes. **Prod**: on merge to `main`, `migrate-prod.yml` waits at the `production` environment gate — approve it in GitHub Actions to apply pending migrations via the CLI; it auto-passes when nothing is pending. Never apply prod DDL by hand or via MCP (#570; first gated run requires the ledger audit in `docs/runbooks/PROD_MIGRATION_LEDGER_REPAIR.md`).
- **Expand/contract (hard constraint)**: migrations merged with code must be backward-compatible with the currently deployed code; destructive changes (drops/renames) ship in a later PR after no code references the old shape. Vercel deploys on merge while the migration awaits approval, so both orderings must be safe.
- Refs: dev `iymwxdewcpvpjgzewtzk` (`tevd-portal-dev`, the default link in `supabase/config.toml`, also the day-to-day local dev target per #563), prod `ynykjpnetfwqzdnsgkkg`. Never link/push prod from a dev machine without an explicit ticket.
- Local Supabase stack (Docker, #547): superseded by the hosted DEV project (#563) for all local dev, including the authenticated E2E suite — see "Authenticated E2E (Clerk)" above. Keep the local stack option only if you specifically need per-machine data isolation.
- **preview-smoke fixture**: the guest flow needs one published, guest-visible guide (`slug=e2e-smoke-guide`) in DEV. Seed it with `npm run seed:smoke-guide` against a DEV-configured env (the script refuses any non-DEV/local target). It persists — the only thing that drops it is **reloading/re-mirroring DEV from prod**, so make re-seeding the final step of any such reset. If it's ever missing, the `library-guide` spec skips (with a pointer) rather than failing.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `npm ci` fails with `EBADPLATFORM` on Windows | Fixed by #546 (Linux native binaries moved to `optionalDependencies`). On an older checkout: `npm ci --force`. |
| `supabaseUrl is required` on `npm run dev` | `.env.local` (and/or `.env.development.local`) missing (fresh clone or worktree). `npm run check:env` to diagnose; in a worktree, `npm run env:worktree`. |
| Build passes locally, fails on Vercel | Run `npm run build` locally (same command CI/Vercel run); check the Vercel build log linked in the PR. CI builds with placeholder env — code that requires real env at *build time* will differ. |
| Type errors in IDE but `npm run test` passes | Vitest and `tsc` use different configs — run `npm run check-types`. |
| Mobile layout broken | Devtools at 390px width; `npm run test:mobile` catches horizontal overflow on smoke-covered routes. |
