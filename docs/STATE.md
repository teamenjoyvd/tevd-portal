## Goal
BUILD issue #678 (2607-DEV-678, branch `dev/2607-DEV-678`): admin section 390px mobile sweep — every `/admin/*` route renders correctly at 390px in both BG and EN, guarded by a new authenticated Playwright spec. Folds in #680 (PaymentsClient pins English), which otherwise blocks BG verification on `/admin/payments`.

## Now
GCR pass on PR #685: all 8 CI checks green, Vercel preview READY, CodeRabbit posted 5 threads. All 5 addressed locally in one commit (6 files) — awaiting the user's go-ahead to push.

## Next
1. Push the GCR commit; wait for CI + preview to go green again.
2. Resolve the 4 fully-applied CodeRabbit threads; reply-then-leave-open on the partially-applied truthiness thread (boolean-only sites skipped).
3. Merge, then GCR tail: remove the `docs/CLAIMS.md` row, close #678 and #680.
5. No migrations — no `migrate-prod` gate; just confirm the prod deploy is READY and smoke-check the production URL.

## Constraints
- 390px mobile-first.
- No `git push` unless the user asks for a push in this conversation (quote required). Asked and granted this session ("Push + open draft PR") — that grant covers this branch only, not future ones.
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
- `GuideAttachmentsPanel.tsx:89` is a 5th `makeDragHandlers` consumer; its reorder is equally touch-dead. Not wired to `moveBy` in this PR.
- `app/admin/components/LangTabs.tsx` has **zero consumers** repo-wide; its docstring claiming "Used by AnnouncementsTab" is false. Deliberately left untouched here — it belongs in #681's dead-stub cleanup.
- The 390px spec asserts overflow only, not locale. It cannot catch English-pinned strings, which is why the #680 gap in `PendingPaymentsSection` survived the first green run.
- `PendingPaymentsSection` returns `null` when there are no pending payments, so CI's seed data never renders it. Its 390px layout is unverified by the spec — fixed by inspection, not by assertion.
- `moveBy` reads the render-time `local` rather than the `setLocal` updater form, on purpose: `onDrop` is a mutation and a side effect inside an updater double-fires under StrictMode. Real taps are separate ticks, so `local` is current.

## Failed attempts
(none yet)
