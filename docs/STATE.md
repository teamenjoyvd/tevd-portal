## Goal
BUILD issue #678 (2607-DEV-678, branch `dev/2607-DEV-678`): admin section 390px mobile sweep — every `/admin/*` route renders correctly at 390px in both BG and EN, guarded by a new authenticated Playwright spec. Folds in #680 (PaymentsClient pins English), which otherwise blocks BG verification on `/admin/payments`.

## Now
All 6 steps implemented and committed (`c0f11fb`, 24 files). Branch pushed; draft PR #685 open. Waiting on CI — specifically the `Authenticated E2E (Clerk)` job, which is the only thing that has actually executed `e2e/admin-mobile-auth.spec.ts`.

## Next
1. Confirm `Authenticated E2E (Clerk)` on PR #685 ran its steps (not green-by-skip) and is green. Any 390px assertion failure names the exact route/tab/locale — fix that surface, don't loosen the assertion.
2. Confirm Vercel preview READY.
3. Mark PR #685 ready for review → single CodeRabbit pass → fix all findings in ONE batched push.
4. Merge, then GCR: remove the `docs/CLAIMS.md` row, close #678 and #680.
5. No migrations — no `migrate-prod` gate; just confirm the prod deploy is READY and smoke-check the production URL.

## Constraints
- 390px mobile-first.
- No `git push` unless the user asks for a push in this conversation (quote required). Not asked yet.
- Never push to `main`; `dev/2607-DEV-678` only.
- Never weaken a check to make it pass.
- Fold the `docs/CLAIMS.md` row + `docs/STATE.md` updates into this PR — no standalone cleanup PR.
- Fix tab overflow at the admin call sites; do NOT modify `components/ui/tabs.tsx` (shared shadcn primitive with non-admin consumers).
- Scope guard: EST ~35 files / ~550 lines. Stop and report if actual passes 2x either number, or needs a migration / new dependency / API contract change.

## Decisions
- Tab rails stay INSIDE the shell padding (`app/admin/layout.tsx:20` = `px-4 md:px-6 lg:px-8`). No negative margins — a flat `-mx-4` under-compensates at `md`/`lg` and clips the active pill's rounded edge.
- Touch reorder = explicit move up/down buttons (`sm:hidden`), not a pointer-events DnD rewrite. Reuses the existing per-tab reorder `useMutation`; no new API route.
- `NotificationsTab` uses the single-tree `flex flex-col md:grid` morph from `EmailLogTable.tsx:164-183`, NOT a duplicated `hidden md:block` / `md:hidden` tree — the duplicated-tree approach is exactly the bug being deleted from `payments/page.tsx`.

## Facts
- Verified against `beabac8`. Issue body's line numbers are partly stale — corrections posted as issue comment 5142555431 and mirrored in the plan file.
- `useDragSort.ts` exports `makeDragHandlers`, not a hook. Its existing `onDrop()` (`:27`) maps the stale `local` captured at render — `moveBy` must compute and pass its own array.
- `EventRolesTab:140` chip wall already has `flex-wrap` + `truncate`; the defect is vertical height from indistinguishable recurring-event titles, not x-overflow.
- `playwright.config.ts` regexes at `:60`/`:72`/`:79` are literal alternations of three exact filenames — a new spec must be added to all three.
- BG locale in e2e = `tevd_lang` cookie; precedent `e2e/guest-invite.spec.ts:192`.
- #679 closed by `beabac8`: `Authenticated E2E (Clerk)` genuinely runs in CI now (15 tests, ~4 min). Step 6 is a real merge gate.
- `app/globals.css:44` sets `html { overflow-x: hidden }` — clips visually but `scrollWidth` still reports true overflow, so the 390px assertion is valid.

## Done
- CLAIM: issue #678 gained `## Design Checklist` (all four checked) + `## Branch`; verification-corrections comment posted; branch `dev/2607-DEV-678` cut from `beabac8`; `docs/CLAIMS.md` row added and the merged #683 row pruned.
- BUILD steps 1-6, commit `c0f11fb`, 24 files (scope guard was ~35 — inside budget).
- Verified locally: `npx tsc --noEmit` clean; `npm run build` ✓ compiled successfully; `npm run lint` 0 errors / 477 warnings vs. 481 baseline (4 fewer, none new).
- Draft PR #685 opened with `Closes #678` + `Closes #680`.

## Open items
- **`e2e/admin-mobile-auth.spec.ts` has never been run locally.** Docker was unavailable so local Supabase could not start, and `.env.local` points at PROD, which is not a legitimate target for authenticated e2e. User chose CI as the gate. Until that job is green, the spec is unproven in both directions — it has not been seen red either, so it is not yet known to detect anything.
- `EventForm.tsx:213` has a fourth `flex gap-2` (form footer) left untouched pending the 390px assertion. NOTED, not done.
- `LogPaymentForm.tsx` still uses `t(key, 'en')` throughout. Out of #680's stated scope (which named `PaymentsClient.tsx` only) and behind a drawer the spec does not open — worth a follow-up issue if BG matters in that drawer.
- `GuideAttachmentsPanel.tsx:89` is a 5th `makeDragHandlers` consumer; its reorder is equally touch-dead. Not wired to `moveBy` in this PR.

## Failed attempts
(none yet)
