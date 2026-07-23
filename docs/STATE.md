## Goal
Issue #653 (2607-DEV-653, branch `dev/2607-DEV-653`): Calendar multi-day rendering — Month view spanning bars, Agenda per-day rows, popup date range for all-day events. Depends on #652 (merged, PR #654).

## Now
PR [#655](https://github.com/teamenjoyvd/tevd-portal/pull/655) open, marked ready for review by the user (no longer draft) at 2026-07-23T22:23:17Z. `/code-review low` found one real bug (Month view `gridStart` derived from `current` instead of the Sofia month key) — fixed. `390px smoke vs preview` initially failed twice post-push: first on a stale e2e selector (`[role="gridcell"] button` — fixed, spanning bars are now row-level siblings of gridcells, not children), then intermittently on `e2e/library-guide.spec.ts` timing out against `/library?type=guides` — confirmed as a pre-existing preview-infra flake unrelated to this PR (this branch touches zero files under `app/library`/`lib/server`/`scripts`; same commit passed on one re-run and failed on another). All CI checks green as of the latest re-run except CodeRabbit, which just started its real (non-draft) pass.

## Next
- Wait for CodeRabbit's pass on PR #655, fix all findings in one batched push (GCR step)
- Manually verify against the issue's DoD checklist against the preview: Month view continuous bar across a real multi-day event (Oct 2026 `WES` event, or June 2026), week-boundary split segments, `+N` overflow correctness, arrow-key traversal + click-empty-space-still-fires-onDayClick, 390px no horizontal overflow, Agenda `Day N/M` markers (en + bg), popup date range (no `01:00–01:00`)
- Merge → GCR (remove #653's `docs/CLAIMS.md` row, close issue)

## Constraints
- Never push directly to `main`; `dev/[YYMM]-DEV-[GH#]` branches only
- Never mark Done on static analysis alone — Vercel PR preview must be READY and CI green
- No `git push` without the user explicitly asking for a push in-conversation (quote required)
- No failing check gets weakened/skipped to pass
- Never spin a solo cleanup-only PR just to prune a `docs/CLAIMS.md` row — fold it into the merging feature PR

## Decisions
DECISION: Segment/lane packing for Month-view spanning bars extracted into a pure, DOM-free `lib/calendar-layout.ts` (`packWeek`) rather than inlined in `MonthView.tsx`, so the packing algorithm (ordering, lane assignment, overflow) is directly unit-testable without React/DOM — matches the issue's explicit ask ("pure function, unit-tested directly — not through the DOM").
DECISION: Day-cell/bar layout uses one shared CSS Grid per week row (day cells `gridRow: '1 / -1'`, bars as later DOM siblings with explicit `gridColumn`/`gridRow`) rather than absolute positioning — bars naturally paint above day cells and clicks on empty cell area fall through to the cell's own `onClick`, satisfying the "click interception" DoD item with no `pointer-events` hack.
DECISION: `useCalendar`'s `current` month state and `MonthView`'s day-number/`isCurrentMonth` test now derive from Sofia date keys (`SOFIA_DATE_FMT`) instead of runtime-local `Date` getters, per issue item 2.4 — `current` is anchored to noon UTC on the 1st of the month so local getters agree with the Sofia month across realistic runtime timezones.
DECISION: All-day popup date range formatted via a small local `formatAllDayRange` helper (bg-BG locale, matching `formatLongDate`'s existing locale) rather than adding new translated strings — the range is numeric dates only, no fixed English/Bulgarian words to translate beyond the em dash.

## Facts
- Hosted DEV Supabase project: `iymwxdewcpvpjgzewtzk`, prod: `ynykjpnetfwqzdnsgkkg`
- #652 merged as PR #654 (`a6aad9b`) before this session started; #653's `blocked` label removed, confirmed no other blockers.
- New file `lib/calendar-layout.ts` (+ `lib/calendar-layout.test.ts`, 8 tests): `packWeek()` pure segment/lane packer, `MAX_LANES = 3`.
- `lib/calendar-dates.ts` gained `prevMonthKey` (symmetric to existing `nextMonthKey`), needed for Sofia-month-key-based navigation in `useCalendar.ts`.
- Files touched this session: `MonthView.tsx`, `EventPill.tsx`, `AgendaView.tsx`, `useCalendar.ts`, `popup/EventPopupShell.tsx`, `popup/types.ts`, `lib/i18n/domains/calendar.ts`, `lib/calendar-dates.ts`, `lib/calendar-layout.ts` (new), `lib/calendar-layout.test.ts` (new). No schema/migration changes.
- Accessibility trade (flagged in the issue as worth a second opinion): bars are `aria-hidden`/`tabIndex={-1}`; each `role="gridcell"` gets an `aria-label` enumerating covering events with `Day N/M` context instead.

## Done
#653 PLAN — RESULT: issue #653 already carried a complete Design Checklist (DoD, affected files, gotchas) from its author; verified premises against current code (`MonthView.tsx:39`, `AgendaView.tsx:32` start-date-only bucketing; `EventPopupShell.tsx:110` unconditional start–end render; `lib/calendar-dates.ts`/`is_all_day` plumbing already present from #652) before proceeding — no redesign needed.
#653 CLAIM — RESULT: branch `dev/2607-DEV-653` cut from `main` (`a6aad9b`); `docs/CLAIMS.md` #652 row (merged) replaced with a #653 row; issue body updated with `## Branch`; `blocked` label removed.
#653 BUILD — RESULT: `lib/calendar-layout.ts` (new, `packWeek` segment/lane packer) + 8 unit tests; `MonthView.tsx` rewritten to a shared week-grid layout with spanning bars, Sofia-keyed day numbers/`isCurrentMonth`, per-cell `aria-label`; `EventPill.tsx` gained `continuesLeft`/`continuesRight`; `AgendaView.tsx` fans multi-day events across covered days with a `Day N/M` marker (new `cal.dayOf` i18n key, en+bg); `EventPopupShell.tsx`/`popup/types.ts` show a date range for all-day events instead of `01:00–01:00`; `useCalendar.ts` + `lib/calendar-dates.ts` (`prevMonthKey`, new) made month navigation Sofia-month-key based. `tsc --noEmit` clean, `npm run lint` 0 errors, `npx vitest run` 207/207 passed. Committed locally, not pushed. Browser/preview/390px verification not yet done.

## Open items
- Full DoD verification (browser, 390px, arrow-key/click-through, real multi-day events) — see `## Next`
- `/code-review low` on the diff before pushing
- Issue #601's post-merge tail (prod smoke-check, `migrate-prod` confirmation) — carried over from a prior session, unrelated to #653, flag if prod state comes up again

## Failed attempts
(none this session)
