## Goal
Issue #607 (2607-DEV-607, branch `dev/2607-DEV-607`): merge the duplicate bento registries into `bento-registry.ts`, fix sub-44px collapse/expand tap targets in `SortableBento.tsx` via a new shadcn `Button`, and add a single `useProfile.ts` hook to kill the `['profile']` queryFn race across profile bento components.

## Now
EXECUTE steps 1-3 done, code changes complete and typecheck/lint/build all green. About to update issue #607's body (Affected files + DoD) to reflect the pr-16->pr-24 scope expansion, then commit and push a draft PR.

## Next
1. Update issue #607 body: add 8 newly-touched files to Affected Files, add a DoD line for "no header/overlay overlap at 390px".
2. Commit all working changes on `dev/2607-DEV-607` (one or a few commits).
3. Push, open PR as **draft** (`Closes #607` in body), wait CI green + Vercel Preview READY — no local authenticated browser check was possible (see Facts), so Preview + CI's "390px smoke vs preview" + "Authenticated E2E" jobs are the real verification gate here, not local click-through.
4. Mark ready for review -> one CodeRabbit pass -> fix all findings in one batched push.
5. Merge; confirm prod Vercel deployment READY (no migration in this PR, no migrate-prod gate); remove `docs/CLAIMS.md` `#607` row; confirm issue #607 auto-closed.

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — not yet asked this session
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass

## Decisions
DECISION: `bento-registry.ts` holds `BENTO_IDS`, `DEFAULT_ORDER`, `BENTO_KEY_MAP` together (~40 lines) — single new file, per PLAN scope.
DECISION: fetch moves to `ProfileClient.tsx` via `useProfile()` at parent mount (was implicitly owned by whichever of `PersonalDetailsContent`/`AboInfoContent` mounted first) — kills the hydration race without changing any consumer's read shape.
DECISION: `components/ui/button.tsx` added via `npx shadcn@latest add button`, retheme'd to project CSS vars per GOTCHAS (shadcn defaults like `bg-primary`/`bg-accent`/`ring-ring` aren't defined in this repo's Tailwind config) — `ghost`/`icon` variant used only for `SortableBento.tsx`'s collapse/expand controls this ticket; `icon` size bumped `h-10 w-10` (40px) -> `h-11 w-11` (44px) to actually satisfy the ≥44px DoD item.
DECISION (user-approved, scope expansion): bumping the toggle to 44px grew SortableBento's absolute overlay control cluster (drag handle 44 + gap 6 + toggle 44 = 94px) past every bento header's `pr-16` (64px) right-padding reserve — confirmed by geometry, not guessed. Presented 3 options (full `pr-16`->`pr-24` fix across 11 sites / revert to a DragHandle-style non-shadcn 44px wrapper keeping `pr-16` untouched / abort). User picked the full fix. Applied `pr-16` -> `pr-24` (96px) in 10 files (11 occurrences — `AboInfoContent.tsx` has 2): `VitalsSection.tsx`, `StatsSection.tsx`, `TravelDocContent.tsx`, `UserSettingsContent.tsx`, `TripsSection.tsx`, `AdminSection.tsx`, `ParticipationSection.tsx`, `PaymentsSection.tsx`, `PersonalDetailsContent.tsx`, `AboInfoContent.tsx`.

## Facts
- Profile route files: `app/(dashboard)/profile/components/*.tsx`, types in `app/(dashboard)/profile/types.ts`.
- `profile.bento.invites` translation key already exists (`lib/i18n/domains/profile.ts:145`).
- No shadcn `Button` was vended before this ticket (checked `components/ui/` at session start: PageLoading, alert-dialog, dialog, drawer, dropdown-menu, popover, select, sheet, skeleton, sonner, table, tabs, tooltip, vaul-drawer — no button.tsx). Added via `npx shadcn@latest add button`; no injected `@layer base` block to revert this time (checked `git status` on `app/globals.css`/`styles/` — clean).
- No Playwright spec covers profile bento behavior (checked `e2e/*.spec.ts` — only `guest-invite.spec.ts`, `los-submission-auth.spec.ts` touch adjacent areas).
- No local authenticated browser verification performed — no stored Clerk DEV credentials for the manually-seeded CORE test profile (`clerk_id user_3GUoYV40gd3jCt0zjEQgkj4hT0v`, per earlier-session memory) are available in this session/environment.
- `tsc --noEmit` clean, `npm run lint` 0 errors / 492 warnings (same baseline as before this session's edits), `npm run build` succeeds — all re-verified after the pr-16->pr-24 expansion.
- Prior branch `dev/2607-DEV-631` confirmed already merged to `main` as PR #658 (commit `92ae8b6`) before `dev/2607-DEV-607` was cut from fresh `main`.

## Done
#607 PLAN — RESULT: READY verdict, DoD scoped to bento-registry.ts + useProfile.ts (new) + button.tsx (new) + 6 modified files.
#607 CLAIM — RESULT: issue body updated with `## Design Checklist` (all 4 checked) + `## Branch`; branch `dev/2607-DEV-607` cut from `main` (`38684e6` CLAIMS.md row commit).
#607 BUILD (code complete) — RESULT: `bento-registry.ts` + `useProfile.ts` created and wired into all 5 consumers; `components/ui/button.tsx` added (retheme'd to project CSS vars, `icon` size bumped to 44px) and used for `SortableBento.tsx` collapse/expand; `pr-16`->`pr-24` applied to 10 header files (11 occurrences) to prevent overlay overlap, per user-approved scope expansion. `tsc`/`lint`/`build` all clean. Not yet committed/pushed.

## Open items
- Issue #607 body still needs updating (Affected Files + DoD) for the pr-16->pr-24 expansion before/with the push — not done yet.
- No local authenticated visual check of the 44px controls or the header spacing fix — must be confirmed via Vercel Preview (390px) once the PR is up.

## Failed attempts
None yet.
