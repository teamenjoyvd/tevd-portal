## Goal
BUILD issue #678 (2607-DEV-678, branch `dev/2607-DEV-678`): admin section 390px mobile sweep — every `/admin/*` route renders correctly at 390px in both BG and EN, guarded by a new authenticated Playwright spec. Folds in #680 (PaymentsClient pins English), which otherwise blocks BG verification on `/admin/payments`.

## Now
CLAIM complete. Starting BUILD step 1 (shared primitives): `AdminTabs.tsx` scroll rail, `AdminListCard.tsx` stacking + move up/down, `useDragSort.ts` `moveBy`, wire the 4 content tabs, `LangTabs.tsx` flex-wrap.

## Next
1. Step 1 — shared primitives. Check: `npm run build`; `/admin/content` at 390px EN+BG; reorder persists across reload.
2. Step 2 — `SettingsTabs.tsx` rail (fix at call site, not `components/ui/tabs.tsx`).
3. Step 3 — Approval Hub: `EventRolesTab` chip label gains a date + rail; action rows at `EventRolesTab:216` / `TripRegistrationsTab:171` stack under `sm`.
4. Step 4 — Calendar inner pill groups `flex-wrap`; `AdminCalendarClient:309` event rows stack; `EventForm:125/137/149`.
5. Step 5 — delete duplicate render at `payments/page.tsx:38-63`; PaymentsClient → `useLanguage()` + 7 new keys in `lib/i18n/domains/admin/operations.ts`; grid prefixes; `NotificationsTab` → EmailLogTable morph; `MembersTable` overflow-x-auto.
6. Step 6 — new `e2e/admin-mobile-auth.spec.ts`; register in all three regexes in `playwright.config.ts` (`:60`, `:72`, `:79`).
7. `/code-review low` on the diff, fix locally, then push + draft PR (`Closes #678`, `Closes #680`).

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

## Open items
- `/admin/payments` BG verification depends on the folded-in #680 fix landing in step 5.

## Failed attempts
(none yet)
