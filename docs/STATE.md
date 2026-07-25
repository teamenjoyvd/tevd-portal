## Goal
Issue #607 (2607-DEV-607, branch `dev/2607-DEV-607`): merge the duplicate bento registries into `bento-registry.ts`, fix sub-44px collapse/expand tap targets in `SortableBento.tsx` via a new shadcn `Button`, and add a single `useProfile.ts` hook to kill the `['profile']` queryFn race across profile bento components.

## Now
PR [#659](https://github.com/teamenjoyvd/tevd-portal/pull/659) open against `main` (`Closes #607`). CI was all green and Vercel Preview/CodeRabbit SUCCESS as of the last check (commit `7da7eac`), except "Authenticated E2E (Clerk)" is a known green-by-skip (3s, only ran `Set up job`/`Check required secrets` — see Facts). CodeRabbit's 4 findings (1 Major, 2 Minor, 1 Trivial) were all applied locally in commit `9ef2f57`. **As of this cleanup, commits `c820099` and `9ef2f57` are local only — not pushed** (user said "Not yet" when asked). `docs/CLAIMS.md` `#607` row pruned now, at the user's explicit instruction, before the branch's fixes are even pushed let alone merged — normally this waits for merge per the CLAIM-Complete Definition's race-window note, so there is currently no claims-registry guard on the `app/(dashboard)/profile/components/*` / `useProfile.ts` / `components/ui/button.tsx` files even though real unpushed and unmerged work sits on `dev/2607-DEV-607`.

## Next
- Push commits `c820099` and `9ef2f57` to `origin/dev/2607-DEV-607` (needs explicit user go-ahead per session constraint — asked once already, declined "Not yet").
- Resolve the 4 CodeRabbit review threads on PR #659 (all fixed locally, not yet resolved since nothing's pushed) — `ProfileClient.tsx:55`, `SortableBento.tsx:136`, `CalendarSection.tsx:22-28`, `PersonalDetailsContent.tsx` nitpick re: `TravelDocContent.tsx`.
- Re-verify CI green + Preview READY on the new commits once pushed (not just the pre-fix `7da7eac` state).
- Verify live on preview: single `/api/profile` fetch (Network tab), drag reorder, collapse/expand, `ui_prefs.bento_order` restore (now gated on `layoutRestored`), no header/overlay overlap at 390px.
- Merge (only if/when user asks); confirm prod Vercel deployment READY (no migration in this PR, no migrate-prod gate); confirm issue #607 auto-closed via `Closes #607`.

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — asked twice this session (draft PR push: yes; GCR-fix push: "Not yet", still holding)
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass

## Decisions
DECISION: `bento-registry.ts` holds `BENTO_IDS`, `DEFAULT_ORDER`, `BENTO_KEY_MAP` together (~40 lines) — single new file, per PLAN scope.
DECISION: fetch moves to `ProfileClient.tsx` via `useProfile()` at parent mount (was implicitly owned by whichever of `PersonalDetailsContent`/`AboInfoContent` mounted first) — kills the hydration race without changing any consumer's read shape.
DECISION: `components/ui/button.tsx` added via `npx shadcn@latest add button`, retheme'd to project CSS vars per GOTCHAS (shadcn defaults like `bg-primary`/`bg-accent`/`ring-ring` aren't defined in this repo's Tailwind config) — `ghost`/`icon` variant used only for `SortableBento.tsx`'s collapse/expand controls this ticket; `icon` size bumped `h-10 w-10` (40px) -> `h-11 w-11` (44px) to actually satisfy the ≥44px DoD item.
DECISION (user-approved, scope expansion): bumping the toggle to 44px grew SortableBento's absolute overlay control cluster (drag handle 44 + gap 6 + toggle 44 = 94px) past every bento header's `pr-16` (64px) right-padding reserve — confirmed by geometry. Presented 3 options; user picked the full fix. Applied `pr-16` -> `pr-24` (96px) in 10 files (11 occurrences — `AboInfoContent.tsx` has 2).
DECISION (GCR, CodeRabbit-driven): gated `handleDragEnd`/`toggleCollapse`/`toggleAll` in `ProfileClient.tsx` behind `layoutRestored` — before the fix, a drag/collapse during the initial profile fetch (or on fetch error, since `layoutRestored` never flips true then) could persist `DEFAULT_ORDER`-derived state and silently clobber a previously-saved `ui_prefs.bento_order`. Pre-existing bug (not introduced by this PR — `enabled:false` had the same window), surfaced by the diff context; fixed since it's squarely in this PR's bento-persistence scope.
DECISION (GCR, CodeRabbit-driven): `CalendarSection.tsx`'s display-name sync effect now depends on the resolved `ical_display_name` value, not just `fullProfile?.id`, so a background refetch that changes the saved preference (e.g. another tab) updates the input — matches the existing sync pattern already used in `EmailPrefsSection.tsx`.
DECISION (GCR, CodeRabbit-driven): migrated `TravelDocContent.tsx`'s own separate `['profile']` `useQuery` (missed during BUILD — only `PersonalDetailsContent`/`AboInfoContent` were checked, not the whole directory) to `useProfile()`. Re-grepped the full `app/(dashboard)/profile/components/` dir afterward for `queryKey:\s*\[.profile.\]` — confirmed no other duplicates remain.
DECISION (user-directed): `docs/CLAIMS.md` `#607` row pruned now even though `dev/2607-DEV-607`'s latest commits are unpushed and PR #659 unmerged — see `## Now` for the resulting guard gap.

## Facts
- Profile route files: `app/(dashboard)/profile/components/*.tsx`, types in `app/(dashboard)/profile/types.ts`.
- `profile.bento.invites` translation key already exists (`lib/i18n/domains/profile.ts:145`).
- No shadcn `Button` was vended before this ticket. Added via `npx shadcn@latest add button`; no injected `@layer base` block to revert (checked `git status` on `app/globals.css`/`styles/` — clean).
- No Playwright spec covers profile bento behavior (`e2e/*.spec.ts` — only `guest-invite.spec.ts`, `los-submission-auth.spec.ts` touch adjacent areas).
- No local authenticated browser verification performed this session — no stored Clerk DEV credentials available in this environment for the manually-seeded CORE test profile (`clerk_id user_3GUoYV40gd3jCt0zjEQgkj4hT0v`, per earlier-session memory).
- PR #659's "Authenticated E2E (Clerk)" CI job is green-by-skip: `gh run view --job` showed only `Set up job` and `Check required secrets` executed (3s total), every real step (`Seed Clerk test users`, `Run authenticated Playwright project`, etc.) shows `-` (skipped) — matches known pre-existing project gap, not something fixable from this session.
- `tsc --noEmit` clean, `npm run lint` 0 errors / 490 warnings (down from 492 baseline — no new warnings), `npm run build` succeeds — all re-verified after the GCR fixes (commit `9ef2f57`).
- Prior branch `dev/2607-DEV-631` confirmed already merged to `main` as PR #658 (commit `92ae8b6`) before `dev/2607-DEV-607` was cut from fresh `main`.
- Local commit chain on `dev/2607-DEV-607`: `38684e6` (CLAIMS.md row, pushed), `7da7eac` (BUILD code, pushed), `c820099` (STATE.md update, **local only**), `9ef2f57` (GCR fixes, **local only**), plus this cleanup commit.

## Done
#607 PLAN — RESULT: READY verdict.
#607 CLAIM — RESULT: issue body updated with `## Design Checklist` (all 4 checked) + `## Branch`; branch `dev/2607-DEV-607` cut from `main`.
#607 BUILD — RESULT: `bento-registry.ts` + `useProfile.ts` created and wired into all 6 consumers (5 planned + `TravelDocContent.tsx` caught during GCR); `components/ui/button.tsx` added and used for `SortableBento.tsx` collapse/expand; `pr-16`->`pr-24` applied to 10 header files. Draft PR #659 pushed, CI green, Preview/CodeRabbit SUCCESS on `7da7eac`.
#607 GCR — RESULT: all 4 CodeRabbit findings applied (bento-persistence race gated on `layoutRestored`, aria-labels added, CalendarSection sync fixed, TravelDocContent duplicate query removed). `tsc`/`lint`/`build` clean. Commit `9ef2f57` — **local only, not pushed** (user held off when asked).

## Open items
- Push `c820099` + `9ef2f57` to origin and resolve the 4 CodeRabbit threads — blocked on user go-ahead.
- Re-verify CI/Preview on the pushed GCR-fix commit (current green status is from the pre-fix commit `7da7eac`).
- No local authenticated visual check of the 44px controls, header spacing fix, or single-fetch behavior — must be confirmed via Vercel Preview once the fixes are live.
- `docs/CLAIMS.md` guard gap on `app/(dashboard)/profile/components/*`/`useProfile.ts`/`components/ui/button.tsx` until PR #659 actually merges (row pruned early per user instruction).

## Failed attempts
None.
