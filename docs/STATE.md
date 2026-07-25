## Goal
Issue #607 (2607-DEV-607, branch `dev/2607-DEV-607`): merge the duplicate bento registries into `bento-registry.ts`, fix sub-44px collapse/expand tap targets in `SortableBento.tsx` via a new shadcn `Button`, and add a single `useProfile.ts` hook to kill the `['profile']` queryFn race across profile bento components.

## Now
PR [#659](https://github.com/teamenjoyvd/tevd-portal/pull/659) open against `main` (`Closes #607`), all commits pushed (`d769ab4` is the tip). CI all green on the pushed commit (Type Check, Lint, Test, Build, Security Audit, Migrations Check, 390px smoke vs preview all SUCCESS), Vercel Preview SUCCESS, CodeRabbit status SUCCESS. Both real CodeRabbit review threads (`ProfileClient.tsx:55` Major, `SortableBento.tsx:136` Minor) resolved via GraphQL `resolveReviewThread` after confirming the fix commit was live. "Authenticated E2E (Clerk)" still shows SUCCESS but is a known green-by-skip (see Facts) — not something this session can fix. **Not merged** — user has not asked to merge.

## Next
- User will decide when to mark ready-for-review / merge — no action needed unless asked.
- If asked to merge: confirm PR isn't still draft, confirm no new CodeRabbit findings appeared, merge, then run the post-merge tail (below).
- Post-merge tail (not yet run): confirm prod Vercel deployment READY (no migration in this PR, no `migrate-prod` gate to approve); confirm issue #607 auto-closed via `Closes #607`; re-add or confirm removal is final for the `docs/CLAIMS.md` `#607` row (already pruned pre-merge, see Decisions).
- Still open: no local authenticated visual check was ever done (no stored Clerk DEV credentials this session) — if the user wants that confirmed, it needs their own manual check or credentials supplied to a future session.

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — asked and granted twice this session (draft PR push, then GCR-fix push after an initial "Not yet")
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
DECISION (user-directed): `docs/CLAIMS.md` `#607` row pruned pre-merge (while PR #659 was still open, at the time even before that push) — normal guard-window gap, accepted per explicit user instruction.
DECISION: only the 2 inline-postable CodeRabbit comments (`ProfileClient.tsx:55`, `SortableBento.tsx:136`) had real GitHub review threads and were resolved via `resolveReviewThread`. The other 2 findings (`CalendarSection.tsx` "outside diff range", `TravelDocContent.tsx` "nitpick") were embedded in the review body text only — GitHub never created thread objects for them, so there was nothing to resolve via the API even though both were fixed in code.

## Facts
- Profile route files: `app/(dashboard)/profile/components/*.tsx`, types in `app/(dashboard)/profile/types.ts`.
- `profile.bento.invites` translation key already exists (`lib/i18n/domains/profile.ts:145`).
- No shadcn `Button` was vended before this ticket. Added via `npx shadcn@latest add button`; no injected `@layer base` block to revert.
- No Playwright spec covers profile bento behavior (`e2e/*.spec.ts` — only `guest-invite.spec.ts`, `los-submission-auth.spec.ts` touch adjacent areas).
- No local authenticated browser verification performed this session — no stored Clerk DEV credentials available for the manually-seeded CORE test profile (`clerk_id user_3GUoYV40gd3jCt0zjEQgkj4hT0v`, per earlier-session memory).
- PR #659's "Authenticated E2E (Clerk)" CI job is green-by-skip: `gh run view --job` showed only `Set up job`/`Check required secrets` executed (3s total), every real step shows `-` (skipped) — matches known pre-existing project gap (see memory), not something fixable from this session.
- `tsc --noEmit` clean, `npm run lint` 0 errors / 490 warnings (down from 492 baseline — no new warnings), `npm run build` succeeds throughout.
- Prior branch `dev/2607-DEV-631` confirmed already merged to `main` as PR #658 (`92ae8b6`) before `dev/2607-DEV-607` was cut.
- Full commit chain on `dev/2607-DEV-607`, all pushed: `38684e6` (CLAIMS.md claim row), `7da7eac` (BUILD code), `c820099` (STATE.md pre-push update), `9ef2f57` (GCR fixes), `d769ab4` (STATE/CLAIMS cleanup, pruned claim row).

## Done
#607 PLAN — RESULT: READY verdict.
#607 CLAIM — RESULT: issue body updated with `## Design Checklist` (all 4 checked) + `## Branch`; branch `dev/2607-DEV-607` cut from `main`.
#607 BUILD — RESULT: `bento-registry.ts` + `useProfile.ts` created and wired into all 6 consumers (5 planned + `TravelDocContent.tsx` caught during GCR); `components/ui/button.tsx` added and used for `SortableBento.tsx` collapse/expand; `pr-16`->`pr-24` applied to 10 header files.
#607 GCR — RESULT: all 4 CodeRabbit findings applied and verified (`tsc`/`lint`/`build` clean); 2 real review threads resolved via GraphQL after confirming the fix commit was live in CI/Preview; other 2 findings had no thread object to resolve.
#607 push+verify — RESULT: all 5 commits pushed to `origin/dev/2607-DEV-607`; CI fully green on the final commit (`d769ab4`'s parent code, `9ef2f57`), Vercel Preview SUCCESS, CodeRabbit SUCCESS.

## Open items
- PR #659 not yet merged — waiting on the user.
- Post-merge tail not yet run (prod deploy check, issue auto-close confirmation).
- No local authenticated visual/click-through check was ever performed this session (credentials unavailable) — CI's 390px smoke and the (skip-green, unverified) Authenticated E2E job are the only automated signal; a human check on the live Preview is the real gate here.

## Failed attempts
None.
