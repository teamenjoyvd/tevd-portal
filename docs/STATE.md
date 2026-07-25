## Goal
Issue #613 (2607-DEV-613, branch `dev/2607-DEV-613`): purge dead legacy CSS palette tokens, add semantic `--status-*` tokens for `StatusPill`, fix Mapbox dark styling, update DESIGN-SYSTEM.md.

## Now
Executing trimmed scope after discovering two of the issue's four premises were false in the live codebase (see Decisions). About to edit `app/globals.css`.

## Next
1. `app/globals.css`: delete `--eggshell`/`--deep`/`--sage`/`--sandy`, change `body`'s `background-color` from `var(--eggshell)` to `var(--bg-global)`.
2. `styles/brand-tokens.css`: add `--status-success/-info/-alert/-pending` (+ `[data-theme="dark"]` overrides).
3. `components/admin/StatusPill.tsx`: rebuild on the new tokens (inline style, not Tailwind `dark:` classes).
4. `docs/design/DESIGN-SYSTEM.md`: Component states + Usage rules sections, reflecting actual scope (note Mapbox/calendar chips already correct).
5. `npm run build` + `npm run lint`, then `/code-review low` before pushing draft PR.

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- No `git push` without the user explicitly asking for a push in-conversation (quote required) — not asked yet this session
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No failing check gets weakened/skipped to pass
- Change only lines the task requires — do not touch `--forest`/`--crimson`/`--sienna`/`--stone` (still live, used by calendar files) or the 3 other files also using non-firing `dark:` classes (`ReminderTable.tsx`, `RemindersTab.tsx`, `LinksGuidesTile.tsx` — out of scope, noted only)

## Decisions
DECISION: skip the Mapbox dark-style item entirely — `LocationTile.tsx` and `AboutMapTile.tsx` already implement the exact prescribed pattern (`setStyle()` + `styledata` + `MutationObserver`/`useTheme` watching `data-theme`). Verified by reading both files in full; issue's "confirmed live" claim does not match current code.
DECISION: skip the "calendar chip restyle" — repo-wide grep for `--eggshell|--deep|--sage|--sandy` returns zero hits outside `globals.css`'s own definitions. The calendar files (`FilterControls.tsx`, `MonthView.tsx`, `AgendaView.tsx`, `AdminCalendarClient.tsx`) use `--forest`/`--crimson`/`--sienna`, which `styles/brand-tokens.css:16-17` documents as intentional legacy aliases for brand tokens — not part of this purge, not touching them.
DECISION: only delete the 4 named-dead tokens from `globals.css`'s legacy `:root` block; keep `--forest`/`--crimson`/`--sienna`/`--stone` since they're actively referenced elsewhere and out of the issue's literal scope.
DECISION: `StatusPill` status->token mapping: `sent`->success, `claimed`->info, `failed`+`permanently_failed`->alert (both, distinguished only by label text — only 4 semantic tokens exist for 5 states), `pending`/default->pending.

## Facts
- Theming mechanism: `data-theme="dark"|"light"` attribute on `<html>`, set by `lib/hooks/useTheme.ts` and read via `document.documentElement.getAttribute('data-theme')` — NOT Tailwind's default `dark:` variant (media or `.dark` class), which is why `StatusPill.tsx`'s `dark:bg-*` classes never fire. No `@custom-variant dark` defined anywhere in the repo (confirmed by grep).
- `styles/brand-tokens.css` pattern for dark overrides: single `[data-theme="dark"] { --token: value; }` block redefining light-mode custom properties — new `--status-*` tokens should follow this same shape.
- Other files with the same non-firing `dark:` bug (NOT in scope for #613): `app/admin/calendar/[id]/components/ReminderTable.tsx`, `app/admin/settings/components/RemindersTab.tsx`, `app/(dashboard)/components/tiles/LinksGuidesTile.tsx`.
- `StatusPill` consumers: `ReminderTable.tsx`, `RemindersTab.tsx` — both just render `<StatusPill status={...} />`, no external color coupling.

## Done
#613 CLAIM — RESULT: `blocked` label removed (deps #611/#612 both merged), branch `dev/2607-DEV-613` cut from up-to-date `main`, issue `## Branch` section added, `docs/CLAIMS.md` row registered (pruned stale `#612` row, its PR #663 already merged).
#613 BUILD (code) — RESULT: trimmed scope executed — `app/globals.css` (4 dead tokens removed, `body` bg fixed to `var(--bg-global)`), `styles/brand-tokens.css` (8 new `--status-*` tokens, light+dark), `components/admin/StatusPill.tsx` (rebuilt on tokens via inline style), `docs/design/DESIGN-SYSTEM.md` (Component States + Usage Rules sections). `npm run build` exit 0 (full route manifest generated, TypeScript clean), `npm run lint` 0 errors/485 warnings (none in changed files, pre-existing baseline). Manual diff review done (no `/code-review` skill invokable this session). `npm install` was also run mid-session — 29 packages (`@radix-ui/react-toggle`, `-toggle-group`, `-switch` etc.) were declared in `package.json` but missing from `node_modules`, unrelated pre-existing gap from the merged #610 PR; `package-lock.json` unchanged, so this was a local sync only, not a dependency change.

## Open items
- No local authenticated visual check of `StatusPill` in light/dark was possible (no stored admin Clerk DEV credentials, same gap as #608/#607) — needs a human check on the Vercel Preview before marking ready for review.
- PR body should note the trimmed scope (Mapbox/calendar-chip items already satisfied, not touched) so reviewers aren't surprised by the smaller diff.
- Not yet committed/pushed — no push requested in-conversation yet.

## Failed attempts
- ATTEMPT: ran `npm run build` concurrently with `npm install` (mid-flight dependency sync) — the build process appeared to hang at "Creating an optimized production build..." for several minutes with no forward log output. FIXED by not killing it: confirmed via `Get-CimInstance Win32_Process` that it was still spawning live Turbopack worker processes, so it was slow (3.4min compile), not stuck — waited it out instead of killing. Avoid running `npm install` concurrently with a build in future sessions; it's likely what caused the slowdown/confusion.
