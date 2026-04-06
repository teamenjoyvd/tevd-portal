# Performance Baseline — tevd-portal

> Created: 2026-04-06. Update when a perf-significant change ships.

## Context

All measurements are representative snapshots, not CI-enforced budgets.
Run Lighthouse from an incognito window on the production URL to avoid extension noise.

## Key pages

| Page | Notes |
|---|---|
| `/about` | Mapbox GL JS deferred via `AboutMapTileDynamic` (`next/dynamic`, `ssr: false`). Chunk loads after hydration. |
| `/guides` | Server-prefetched via `lib/server/guides.ts`. TanStack `initialDataUpdatedAt` set at render time; avoids immediate refetch. |
| `/trips` | `initialData` from RSC. Profile + payments fetched client-side after Clerk resolves. |

## Follow-ups (not blocking)

- [ ] `@next/bundle-analyzer` — run locally to inspect chunk sizes after adding any new heavyweight dependency.
- [ ] Lighthouse CI — add `lighthouserc.js` to `.github/workflows/` if regression tracking becomes a priority.
- [ ] Core Web Vitals via Vercel Analytics — already available in the Vercel dashboard.
