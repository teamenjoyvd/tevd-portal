## Goal
BUILD issue #665 (2607-DEV-665, branch `dev/2607-DEV-665`): migrate all 13 `/profile` bentos onto the shared `BentoCard`/`.card` design system — shell, header, skeleton, empty state, elevation tokens.

## Now
Step 2 next: atomic shell refactor across `SortableBento.tsx`, `BentoGrid.tsx`, `ProfileClient.tsx`, and all 13 content components.

## Next
1. Step 2 — atomic shell refactor: `SortableBento.tsx` renders `BentoCard` directly (both branches), delete `bento-mobile-full`; `BentoGrid.tsx` gap token; `ProfileClient.tsx` reads `BENTO_META`; all 13 content components lose `rounded-2xl p-6 h-full` wrapper + inline bg/border + `*_MIN_HEIGHT` exports. Run new e2e spec as the checkpoint (best-effort locally — see Open items on env gap).
2. Step 3a — headers: all 13 components → `<BentoHeader>`.
3. Step 3b — skeletons: all 13 → `<BentoSkeleton>`, add missing states to `CalendarSection`/`EmailPrefsSection`.
4. Step 3c — empty states/icons: `<BentoEmpty>`, lucide icon swaps, dead-code removal per issue.
5. Verification pass per issue's `## Verification` section (build, lint, e2e local, 1280/390 screenshots, dark theme incl. `/` and `/about`).
6. `/code-review low` before push; open draft PR `Closes #665`.

## Constraints
- 390px mobile-first — every bento must render correctly at 390px, including the mobile static-stack path.
- shadcn/ui for any interactive primitive added.
- Component co-location — profile-only components stay under `app/(dashboard)/profile/components/`.
- No Tailwind `dark:` variants in the profile folder — use `[data-theme="dark"]` selectors.
- Preserve dnd-kit drag/reorder, collapse/expand, and `profile.ui_prefs` persistence exactly.
- Cards stay non-interactive — no `interactive-lift`, no whole-card `onClick`.
- No `.bento-tile` entrance animation.
- Do not adopt `.bento-grid` class (`grid-auto-rows`/`grid-auto-flow: dense` conflict) — keep profile's explicit inline grid, only source `gap` from `var(--bento-gap)`.
- Headers stay in content components, not hoisted into `SortableBento` (stateful action buttons live there).
- `PersonalDetailsContent`'s crimson border: plain `style={{ borderColor: 'var(--brand-crimson)' }}` override, NOT `variant="edge-alert"`.
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — not asked yet this session.
- Part 2 (status-token consolidation, back links, colour sweep) is a separate, later issue — do not do that work here even though it touches the same files.
- NOTED items in the issue (RoleRow remount, resetLayout pre-hydration bug, raw status strings, etc.) are deliberately NOT fixed here.

## Decisions
DECISION: follow the issue's own Step 0-4 ordering verbatim rather than re-deriving a plan — it already verified its own file:line claims (confirmed `BentoCard.tsx:69` spread order during PLAN).
DECISION: write the new `e2e/profile-bento-auth.spec.ts` before Step 2's shell refactor (per issue), so it's the checkpoint for the atomic 13-file change, not an afterthought.

## Facts
- Route: `app/(dashboard)/profile/` — `page.tsx` (server) → `ProfileClient.tsx` (builds `bentoMap`, order/collapse state, `profile.ui_prefs` persistence) → `BentoGrid.tsx` (desktop, dnd-kit, dynamic import) or static stack (mobile) → `SortableBento.tsx` (shared shell).
- 13 bento ids: `bento-registry.ts` `BENTO_IDS`/`DEFAULT_ORDER`.
- `BentoCard`/`Eyebrow` live in `components/bento/BentoCard.tsx`; `style` spreads after `spanStyle` at line 69 (verified).
- `components/ui/skeleton.tsx` exports `Skeleton({ className, style })` using `.skeleton-shimmer` + `--skeleton-base`.
- Test commands: `npm run build`, `npm run lint`, `npm run test:e2e:auth`, `npm run test:mobile` (authenticated E2E CI job is a known skip — must run locally against DEV, per memory).
- `BENTO_HEIGHT = { S: 160, M: 280 }` currently lives in `ProfileClient.tsx:40` — moving to `bento-registry.ts` per issue.

## Done
PLAN + CLAIM for #665 — RESULT: issue CLAIM-complete (`## Design Checklist` all checked, `## Branch` = `dev/2607-DEV-665`), branch cut from `main` and pushed, `docs/CLAIMS.md` row registered (pruned stale merged #613 row).

## Open items
- New `e2e/profile-bento-auth.spec.ts` (5 tests) has NOT been executed against a real Clerk/Supabase session — this worktree has no `.env.local`, no local Supabase, no seeded Clerk test users (same gap noted on #613/#608/#607). `playwright test --list` confirms the file is wired correctly into both the `authenticated` and `mobile-390` projects and excluded from `desktop`; actual pass/fail is still unverified. Must run for real (`npm run test:e2e:auth` + `npm run test:mobile`) before claiming Step 2/Verification done, per docs/ai/BUILD.md VERIFY.

## Failed attempts
(none yet)
