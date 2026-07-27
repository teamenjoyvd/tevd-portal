## Goal
BUILD issue #673 (2607-DEV-673, branch `dev/2607-DEV-673`): fix Bulgarian announcement title wrap inflating home bento row 3 + Mapbox canvas not re-measuring under it.

## Now
Starting EXECUTE stage — about to edit `app/(dashboard)/components/tiles/AnnouncementTile.tsx` (title/body clamp) then `app/(dashboard)/components/tiles/LocationTile.tsx` (ResizeObserver + map.resize()).

## Next
1. Edit `AnnouncementTile.tsx`: `h2` gets `md:line-clamp-2 md:min-h-[2.75em]`; body clamp switches from inline `WebkitLineClamp: 4` to Tailwind `line-clamp-4 md:line-clamp-3` classes so it can be responsive.
2. Edit `LocationTile.tsx`: add `ResizeObserver` effect on `mapContainer.current` calling `mapRef.current.resize()`, disconnect on cleanup; widen `mapRef` structural type to include `resize: () => void`.
3. `npm run lint` and `npx tsc --noEmit`.
4. `/code-review low` on the diff, fix findings locally.
5. Push branch, open PR as draft (`Closes #673`), wait CI green + Preview READY.
6. Manual verification: EN/BG toggle at 1440px (row 3 height unchanged, no forest band under map) and at 390px (BG title unclamped, cards stack).
7. Mark PR ready → one CodeRabbit pass → batched fix push → merge → GCR (remove CLAIMS.md row, close issue).
8. No migrations in this PR — no prod gate to approve, just confirm prod deploy READY.

## Constraints
- 390px mobile-first.
- No `git push` of commits without the user explicitly asking for a push in-conversation (quote required) — not asked yet this session. (Branch-ref push for CLAIM scaffolding already done per docs/ai/CLAIM.md, that's a separate, already-approved-by-workflow action.)
- Two files only: `AnnouncementTile.tsx`, `LocationTile.tsx` — per issue's Affected Files list; EST ~20 changed lines.
- Resize observer must be a separate effect from the theme-swap effect and must not touch `setReady` (per issue's Gotchas Flagged).

## Decisions
(none yet — following issue's prescribed change list verbatim, PLAN already validated it against source)

## Facts
- `AnnouncementTile.tsx` title `h2` currently unclamped (`app/(dashboard)/components/tiles/AnnouncementTile.tsx:32-46`); body clamp is inline-style `WebkitLineClamp: 4` (line 53).
- `LocationTile.tsx` has `mapRef` typed `{ remove; setStyle; once }` (line 67), no `resize`; init effect at lines 71-116; theme-swap effect at 119-125; render at 129-153, map container div at 133.
- Desktop-only grid: `app/(dashboard)/page.tsx:81` wraps the whole desktop bento in `hidden md:block`; row 3 track `minmax(220px, auto)` at line 84 (repeat(4, ...)).
- `LocationTileLazy.tsx` wraps `LocationTile` in `next/dynamic` with `ssr:false` — no changes needed there.
- No E2E covers home bento (confirmed: no home-bento spec in `e2e/`).

## Done
PLAN + CLAIM completed this session: issue #673 already had a complete Design Checklist authored at creation (verified DoD against current codebase, matched exactly); added `## Branch` section, cut `dev/2607-DEV-673` from `main`, `docs/CLAIMS.md` row added and committed (8545f19).

## Open items
(none yet)

## Failed attempts
(none yet)
