# Performance Baseline — tevd-portal

> Created: 2026-04-06. Update when a perf-significant change ships.

## Context

All measurements are representative snapshots, not CI-enforced budgets.
Run Lighthouse from an incognito window on the production URL to avoid extension noise.

## Key pages

| Page | Notes |
|---|---|
| `/` | Location tile renders `components/ui/expand-map.tsx` (SVG + framer-motion), server-rendered. Replaced the Mapbox CDN script 2026-08 — these numbers predate that and need a re-measure. |
| `/guides` | Server-prefetched via `lib/server/guides.ts`. TanStack `initialDataUpdatedAt` set at render time; avoids immediate refetch. |
| `/trips` | `initialData` from RSC. Profile + payments fetched client-side after Clerk resolves. |

## Follow-ups (not blocking)

- [ ] `@next/bundle-analyzer` — run locally to inspect chunk sizes after adding any new heavyweight dependency.
- [ ] Lighthouse CI — add `lighthouserc.js` to `.github/workflows/` if regression tracking becomes a priority.
- [ ] Core Web Vitals via Vercel Analytics — already available in the Vercel dashboard.
