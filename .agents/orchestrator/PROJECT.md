# Project: Roles Page Simplification

## Architecture
- Roles page components: `app/(dashboard)/roles/page.tsx`, `app/(dashboard)/roles/components/RolesClient.tsx`, `app/(dashboard)/roles/components/LeaderboardPanel.tsx`.
- Legacy files to remove: `app/(dashboard)/roles/components/HistoryPanel.tsx`.
- i18n: `lib/i18n/domains/events.ts`.
- Queries: `lib/roles/queries.ts`.
- Verification Commands: `npm run build`, `npm run lint`, `npm run check-types`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Explore & Planning | Explore the Roles page structure, parameter handling, queries, i18n, and outline test/mock infrastructure. | None | IN_PROGRESS |
| 2 | Implementation | Consolidate controls layout, toggle state, URL parameter management, delete HistoryPanel, cleanup i18n keys, dynamic year filtering. | M1 | PLANNED |
| 3 | Verification & Auditing | Run type checks, lint checks, build, E2E tests, challenger stress testing, and forensic audit. | M2 | PLANNED |
| 4 | Final Report | Synthesize results and report completion to Sentinel. | M3 | PLANNED |

## Interface Contracts
- Legacy URL parameter fallback: `tab=leaderboard` and `tab=history` must resolve correctly without redirecting.
- The state toggling: toggling History on and off retains active year/quarter selection context.
- Year options fetching: Fetch and filter options dynamically from event database in `queries.ts`.

## Code Layout
- `app/(dashboard)/roles/page.tsx` - Next.js page component for roles.
- `app/(dashboard)/roles/components/RolesClient.tsx` - Client component managing state, layout, and control row.
- `app/(dashboard)/roles/components/LeaderboardPanel.tsx` - Display panel for role leaderboards/history.
- `lib/roles/queries.ts` - Database queries for dynamic filtering of year options.
- `lib/i18n/domains/events.ts` - Localization strings for events and roles.
