# Original User Request

## Initial Request — 2026-06-18T19:35:53Z

Simplify the Roles page controls: remove the old searchable History tab and the heading, rename Leaderboard to History, consolidate all controls into one row, and dynamically filter year options.

Working directory: `c:\Users\fefence\Downloads\react\teamenjoyvd\tevd-portal`
Integrity mode: demo

## Requirements

### R1. Simplified Single-Row Layout
Consolidate controls into a single row: `[YEAR ▼] [Q1] [Q2] [Q3] [Q4]          [History]` using design system tokens. Remove the page heading. Hide the Year/Quarter selectors when History is active.

### R2. Context & Parameter Handling
Preserve the active year/quarter selection in the URL when toggling History on/off. Handle legacy parameters (`tab=leaderboard` or `tab=history`) in the page component to map to the new views without redirecting.

### R3. Remove Legacy History Panel & Clean Up Translations
Delete `HistoryPanel.tsx`. Clean up 12 orphaned i18n keys in `events.ts` and verify no broken translation key references remain.

### R4. Dynamic Year Filtering
Fetch and filter year options dynamically from the event database (via JS deduplication of event start times in `queries.ts`), ensuring only years with actual events appear in the dropdown.

## Acceptance Criteria

### Build & Verification
- [ ] `npm run check-types` runs successfully with no TypeScript compiler errors.
- [ ] `npm run lint` passes without any linter issues.
- [ ] `npm run build` succeeds.

### Layout & Responsiveness
- [ ] Controls fit on a single row without wrapping on a 390px mobile viewport (English & Bulgarian).
- [ ] Left cluster is hidden when History view is active.

### State & URL Integration
- [ ] Toggling History on and then off retains the user's active Year/Quarter selection context.
- [ ] Legacy parameters are resolved correctly fallback-style.
