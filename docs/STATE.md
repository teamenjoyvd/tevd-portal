## Goal
Issue #608 (2607-DEV-608, branch `dev/2607-DEV-608`): collapse `ProfileClient.tsx`'s duplicate desktop/mobile bento render into one mounted tree, and code-split `@dnd-kit/*` off the mobile bundle via `next/dynamic`.

## Now
BUILD code committed locally (`fd54eb7`) on `dev/2607-DEV-608`. Not pushed — no `git push` yet in this conversation (constraint below). Waiting on user go-ahead to push + open draft PR.

## Next
- Get user confirmation to push and open the draft PR (`Closes #608`).
- After draft PR is open: wait CI green + Vercel Preview READY, then mark ready for review to trigger the single CodeRabbit pass (per docs/ai/BUILD.md FINALIZE).
- Still open: no local authenticated visual check at 390px/1280px was possible this session (no stored Clerk DEV credentials) — same gap as #607; flag to user, don't silently skip.
- After merge: run the post-merge tail (prod Vercel deploy check, confirm issue #608 auto-closed, remove `docs/CLAIMS.md` `#608` row).

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — not yet asked this session for #608
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass

## Decisions
DECISION: split `SortableBento.tsx` into a pure presentational card (no `@dnd-kit` import — accepts `cardRef`/`dragStyle`/`dragHandle` as optional props) reused by both the mobile stack and desktop grid, rather than two separate card components — keeps exactly one render definition per bento, satisfying the "single DOM instance" DoD item.
DECISION: new `BentoGrid.tsx` is the sole module importing `@dnd-kit/core`, `/sortable`, `/utilities` (`DndContext`, `SortableContext`, `useSortable`, `CSS`, sensors) — loaded via `next/dynamic(() => import('./BentoGrid'), { ssr: false })` from `ProfileClient.tsx`, gated behind a `matchMedia('(min-width: 768px)')` check (`isDesktop` state, starts `false` so SSR/first paint always render the static mobile branch — no hydration mismatch).
DECISION: `arrayMove` in `BentoGrid.tsx`'s drag-end handler operates on the full `bentoOrder` array (passed down as a prop), not the filtered `orderedBentos` — preserves original semantics where hidden/role-gated bento ids keep their relative position in persisted `ui_prefs.bento_order` even while not rendered.
DECISION: `/code-review low` skill isn't invokable directly in this session (`disable-model-invocation`) — did an equivalent manual diff review instead (see BUILD commit message / conversation) before committing; no blocking findings.

## Facts
- Profile route files: `app/(dashboard)/profile/components/*.tsx` — this ticket touches `ProfileClient.tsx`, `SortableBento.tsx`, and new `BentoGrid.tsx`.
- Worktree at `.claude/worktrees/dev-2607-DEV-608` had no `node_modules` — a Windows junction to the main checkout's `node_modules` fails under Turbopack ("Symlink ... points out of the filesystem root"); ran a real `npm install` in the worktree instead.
- Verified the dnd-kit split at the build-output level (not just source): none of the 13 chunks `page_client-reference-manifest.js` lists as eagerly loaded for `/profile` contain `dnd-kit`/`useSortable`/`DndContext`; a separate 44KB chunk (`12st6nwyn69qu.js`, hash will change per build) contains `DndContext`/`useSortable` and is excluded from that eager list.
- `tsc --noEmit` clean, `npm run lint` 0 errors / 485 warnings (no new warnings vs. #607's 490 baseline — actually down, unrelated files), `npm run build` succeeds, `npx vitest run` 207/207 passed (16 files).
- No local authenticated browser verification possible — no stored Clerk DEV credentials for the manually-seeded CORE test profile (`clerk_id user_3GUoYV40gd3jCt0zjEQgkj4hT0v`, per earlier-session memory). Same gap as #607.
- Issue #608 was labeled `blocked` (dependency on #607) at session start; confirmed PR #659 merged (`mergedAt: 2026-07-25T10:33:07Z`, base `main`) and issue #607 closed before removing the label and proceeding.

## Done
#608 PLAN — RESULT: READY verdict (issue's own blocker was stale — #607 merged).
#608 CLAIM — RESULT: issue body updated with `## Design Checklist` (all 4 checked) + `## Branch`; `blocked` label removed; branch `dev/2607-DEV-608` cut from `main`; `docs/CLAIMS.md` row added.
#608 BUILD (code) — RESULT: `SortableBento.tsx` split into presentational-only; new `BentoGrid.tsx` holds all dnd-kit code; `ProfileClient.tsx` gated on `next/dynamic` + `isDesktop`. Committed `fd54eb7` (175 insertions, 87 deletions, 3 files). `tsc`/`lint`/`build`/`vitest` all green; bundle split confirmed at the built-chunk level.

## Open items
- Draft PR not yet opened — waiting on user's explicit push confirmation.
- No local authenticated visual/click-through check at 390px/1280px was performed this session (credentials unavailable) — CI's 390px smoke is the only automated signal once CI runs; a human check on the live Preview is the real gate.
- Session used `npm install` in the worktree (not junctioned) — worktree now has its own `node_modules` copy, harmless but worth knowing if disk space matters.

## Failed attempts
- ATTEMPT: junction `node_modules` from main checkout into the worktree to avoid a full `npm install` — FAILED: Turbopack's `next build` panics with "Symlink [project]/node_modules is invalid, it points out of the filesystem root" (junctions/symlinks pointing outside the worktree root aren't supported). Fixed by removing the junction and running a real `npm install` inside the worktree.
