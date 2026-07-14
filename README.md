# tevd-portal

Internal management portal for **teamenjoyVD (N21 Community)**: Line of Sponsorship (LOS) data, member management, events & calendar, trips, payments, guides/library, and notifications.

Production: <https://www.teamenjoyvd.com> (Vercel).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Auth | Clerk (route protection lives in `proxy.ts` — this repo deliberately has no `middleware.ts`) |
| Database | Supabase Postgres + Storage + Edge Functions (`supabase/`) — RLS enforced, migrations in `supabase/migrations/` |
| Data fetching | TanStack Query v5 |
| Styling | Tailwind CSS v4 + shadcn/ui primitives |
| Tests | Vitest (unit), Playwright (390px smoke), `scripts/run-e2e-tests.js` (mock e2e) |
| Hosting / CI | Vercel (PR previews + production) + GitHub Actions (`.github/workflows/ci.yml`) |

## Quickstart

```bash
npm ci
cp .env.example .env.local               # Clerk/Mapbox/etc. values (ask a maintainer)
cp .env.example .env.development.local   # Supabase values only — point at the DEV project
npm run dev                              # http://localhost:3000
npm run check:env                        # confirms vars + which Supabase project dev targets
```

`.env.development.local` overrides `.env.local` for local dev and should point `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` at the hosted **DEV** Supabase project (`iymwxdewcpvpjgzewtzk`), never prod. `npm run check:env` confirms the target. Vercel preview URLs still hit the **production** Supabase project — treat preview testing as navigation-only. Details: [docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md).

## Where things live

- **Dev process** (local loop, verification, branch/PR flow): [docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md)
- **Agent ruleset** (all AI agents working in this repo): [CLAUDE.md](CLAUDE.md), non-Claude agents enter via [AGENTS.md](AGENTS.md)
- **Workflow commands** (SSU / PLAN / CLAIM / BUILD / GCR), ID format, labels: [docs/guardrails/PROJECT.md](docs/guardrails/PROJECT.md)
- **Reference tables** (schema, routes, env vars, design system, CI): [docs/ai/REF.md](docs/ai/REF.md); sharp edges: [docs/ai/GOTCHAS.md](docs/ai/GOTCHAS.md)
- **Architecture**: [docs/architecture/](docs/architecture/) (C4.md, FLOWS.md, DECISIONS.md)
- **In-flight work registry** (concurrent agents): [docs/CLAIMS.md](docs/CLAIMS.md); session state: [docs/STATE.md](docs/STATE.md)
- **Historical artifacts** (superseded docs, past orchestration runs): [docs/archive/](docs/archive/README.md)

## Non-negotiables

- Never push to `main` — work lands via `dev/[YYMM]-DEV-[GH#]` branches and PRs (format: [docs/guardrails/PROJECT.md](docs/guardrails/PROJECT.md#id-format))
- Every new UI surface must render correctly at **390px** (mobile-first)
- Never write data to Supabase from a preview URL or local dev while they target production
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; RLS policies use Pattern-A helpers only

Full list: `## Project` → Hard Constraints in [CLAUDE.md](CLAUDE.md).
