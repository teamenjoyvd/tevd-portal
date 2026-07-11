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
cp .env.example .env.local   # then fill in values (ask a maintainer)
npm run dev                  # http://localhost:3000
```

> **Warning — production database:** until [#547](https://github.com/teamenjoyvd/tevd-portal/issues/547) lands, `.env.local` points local dev at the **production** Supabase project, and Vercel preview URLs do too. Treat local/preview testing as navigation-only. Details: [docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md).

## Where things live

- **Dev process** (local loop, verification, branch/PR flow): [docs/DEV_WORKFLOW.md](docs/DEV_WORKFLOW.md)
- **Agent ruleset** (all AI agents working in this repo): [CLAUDE.md](CLAUDE.md), non-Claude agents enter via [AGENTS.md](AGENTS.md)
- **Workflow commands** (SSU / PLAN / CLAIM / BUILD / GCR), ID format, labels: [docs/guardrails/PROJECT.md](docs/guardrails/PROJECT.md)
- **Reference tables** (schema, routes, env vars, design system): [docs/ai/REF.md](docs/ai/REF.md); context: [docs/ai/CONTEXT.md](docs/ai/CONTEXT.md); sharp edges: [docs/ai/GOTCHAS.md](docs/ai/GOTCHAS.md)
- **Architecture**: [docs/architecture/](docs/architecture/) (C4.md, FLOWS.md, DECISIONS.md)
- **In-flight work registry** (concurrent agents): [docs/CLAIMS.md](docs/CLAIMS.md); session state: [docs/STATE.md](docs/STATE.md)
- **Historical artifacts** (superseded docs, past orchestration runs): [docs/archive/](docs/archive/README.md)

## Non-negotiables

- Never push to `main` — work lands via `dev/[YYMM]-DEV-[GH#]` branches and PRs (format: [docs/guardrails/PROJECT.md](docs/guardrails/PROJECT.md#id-format))
- Every new UI surface must render correctly at **390px** (mobile-first)
- Never write data to Supabase from a preview URL or local dev while they target production
- `SUPABASE_SERVICE_ROLE_KEY` is server-only; RLS policies use Pattern-A helpers only

Full list: `## Project` → Hard Constraints in [CLAUDE.md](CLAUDE.md).
