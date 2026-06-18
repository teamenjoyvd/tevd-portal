# Project: Infrastructure Audit Fixes

## Architecture
- **Rules & Configs**: `.cursor/rules/auth.mdc`, `.cursor/rules/database.mdc`, `CLAUDE.md`, `docs/decisions/DECISIONS.md` (or similar location), `docs/ai/GOTCHAS.md`, `docs/ai/GEMINI.md`.
- **Infrastructure Scripts**: `scripts/bootstrap.js`, `scripts/check-infra.js`, `scripts/upgrade-infra.js`.
- **Verification Commands**: `npm run build`, `npm run lint`, `npm run check-types`, `npm run validate-rules`, `npm run agentic:check`, `npm run agentic:bootstrap`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Ticket A | Clerk Auth & Rules Alignment (`auth.mdc`, `CLAUDE.md`, `database.mdc` auth function) | none | DONE |
| 2 | Ticket B | Docs & Architecture Fixes (`database.mdc` ref, `DECISIONS.md`, `GOTCHAS.md`, `GEMINI.md`) | none | DONE |
| 3 | Ticket C | Infra Scripts Hardening (`bootstrap.js`, `check-infra.js`, `upgrade-infra.js` fixes) | none | DONE |
| 4 | Re-sync & Verify | Regenerate baseline hashes and run all validation scripts / test cases | M1, M2, M3 | DONE |

## Interface Contracts
### Scripts ↔ Environment
- `bootstrap.js` must abort if `process.stdin.isTTY` is false.
- `upgrade-infra.js` must abort / default to 'n' if `process.stdin.isTTY` is false.
- `upgrade-infra.js` must clean up `.agentic-temp-clone` upon receiving SIGINT/SIGTERM.
- `check-infra.js` and `upgrade-infra.js` must handle Windows drive letters case-insensitively in `isPathContained`.
