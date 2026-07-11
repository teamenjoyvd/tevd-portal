# Implementation Plan — Roles Page Controls Simplification

This plan outlines the steps required to simplify the Roles page controls, remove legacy tabs/components, update dynamic year options queries, clean up i18n keys, and perform E2E/adversarial verification.

## Steps

### Step 1: Exploration, Planning, and Test Suite Design (Milestone 1)
- **Objective**: Explore page structure, queries, components, and translation files. Design E2E test cases covering Tiers 1-4.
- **Verification**: Verify code locations and document the test suite layout in `TEST_INFRA.md`.

### Step 2: Implementation of Controls, Tabs, Deletions, and DB Queries (Milestone 2)
- **Objective**:
  1. Consolidate controls into a single-row: `[YEAR ▼] [Q1] [Q2] [Q3] [Q4]          [History]`. Remove page heading. Hide the Year/Quarter selectors when History is active. (R1)
  2. URL & context management: preserve year/quarter state when toggling. Resolve legacy parameters (`tab=leaderboard` and `tab=history`) in the page component. (R2)
  3. Delete `HistoryPanel.tsx` and clean up 12 orphaned i18n keys in `events.ts`. Check for any broken translation keys. (R3)
  4. Deduplicate event start times in JS to fetch years dynamically in `queries.ts`. (R4)
- **Verification**: Run TypeScript checks and verify code layout matches `PROJECT.md`.

### Step 3: Verification, Adversarial Hardening, and Forensic Audit (Milestone 3)
- **Objective**: Run all builds/tests/checks, perform E2E test validation, run Challenger tests (Tier 5) for adversarial hardening, and perform Forensic Audit.
- **Verification**: `npm run check-types`, `npm run lint`, `npm run build` must succeed. Forensic audit must be CLEAN. Challenger verifies no gaps.

### Step 4: Final Report & Handoff (Milestone 4)
- **Objective**: Synthesize the findings and report completion to the Sentinel.
- **Verification**: Ensure all checklists are marked complete.
