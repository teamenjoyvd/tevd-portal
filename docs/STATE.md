## Goal
BUILD issue #665 (2607-DEV-665, branch `dev/2607-DEV-665`): migrate all 13 `/profile` bentos onto the shared `BentoCard`/`.card` design system — shell, header, skeleton, empty state, elevation tokens.

## Now
PR #667 opened as draft (`Closes #665`), branch pushed. Waiting on CI + Vercel Preview.

## Next
1. Check CI status and Vercel Preview READY on PR #667.
2. On the Preview: confirm 1280px chrome doesn't overlap Calendar/EmailPrefs/InvitesBento headers, 390px no horizontal overflow, dark theme on all 13 bentos + `/` + `/about` + one modal (Step 1 touched shared `--shadow-*` tokens), loading throttle shows header+shimmer with no vanish/pop and correct switch positions on EmailPrefsSection.
3. Run `npm run test:e2e:auth` + `npm run test:mobile` for real against a real Clerk/Supabase target (not possible in this worktree, no `.env.local`/local Supabase/seeded Clerk users) — paste output, since CI's authenticated E2E job is a known skip.
4. Mark PR ready for review → one CodeRabbit pass → batched fix push → merge → GCR (remove CLAIMS.md row, close issue).
5. After merge: no migrations in this PR, so no prod gate to approve — just confirm prod Vercel deploy READY and smoke-check `/profile`.

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
Step 1 — RESULT: `BentoCard` forwardRef, dark `--shadow-*` tokens, `BentoHeader`/`BentoSkeleton`/`BentoEmpty` created, `bento-registry.ts` `BENTO_META`/`BENTO_ICON_MAP`/`BENTO_HEIGHT`, `profile.calendar.generating` i18n string, DESIGN-SYSTEM.md:74 fixed. `npm run build`/`lint` clean vs baseline. Committed 7bd6fb4.
Step 4 — RESULT: `e2e/profile-bento-auth.spec.ts` (5 tests) written, wired into `playwright.config.ts` (`authenticated` testMatch + `desktop` testIgnore gained `profile-bento-auth`; `mobile-390` picks it up unchanged). `playwright test --list` confirms correct project routing. Committed b9147e6.
Step 2 — RESULT: atomic shell refactor across `SortableBento.tsx` (now renders `BentoCard` directly, both collapsed/expanded branches, `bento-mobile-full` deleted), `BentoGrid.tsx` (gap token), `ProfileClient.tsx` (reads `BENTO_META`/`BENTO_HEIGHT`, computes `personalDetailsIncomplete` and passes it as `cardStyle` through `SortableBento`→`BentoCard`), and all 13 content components (wrapper `rounded-2xl p-6 h-full` + inline bg/border stripped, 7 `*_MIN_HEIGHT` exports deleted + the already-dead `INVITES_MIN_HEIGHT` in `InvitesSection.tsx` = 8 total). `npm run build`/`lint` clean, 480 warnings matches baseline exactly. New e2e spec NOT run for real (env gap, see Open items) — not yet committed.

## Open items
- New `e2e/profile-bento-auth.spec.ts` (5 tests) has NOT been executed against a real Clerk/Supabase session — this worktree has no `.env.local`, no local Supabase, no seeded Clerk test users (same gap noted on #613/#608/#607). `playwright test --list` confirms the file is wired correctly into both the `authenticated` and `mobile-390` projects and excluded from `desktop`; actual pass/fail is still unverified. Must run for real (`npm run test:e2e:auth` + `npm run test:mobile`) before claiming Step 2/Verification done, per docs/ai/BUILD.md VERIFY.

## Failed attempts
(none yet)
