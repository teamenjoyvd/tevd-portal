# Project: Infrastructure Audit Fixes (Gen 2)

## Architecture
- **Rules & Configs**: `.cursor/rules/auth.mdc`, `.cursor/rules/database.mdc`, `CLAUDE.md`, `docs/architecture/DECISIONS.md`, `docs/ai/GOTCHAS.md`, `docs/ai/GEMINI.md`.
- **Infrastructure Scripts**: `scripts/bootstrap.js`, `scripts/check-infra.js`, `scripts/upgrade-infra.js`.
- **Verification Commands**: `npm run build`, `npm run lint`, `npm run check-types`, `npm run agentic:validate` (or `npm run validate-rules` if defined), `npm run agentic:check`, `npm run agentic:bootstrap`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Ticket A | Clerk Auth & Rules Alignment (`auth.mdc`, `CLAUDE.md`, `database.mdc` auth helper) | None | DONE |
| 2 | Ticket B | Docs & Architecture Fixes (`database.mdc` ref, `DECISIONS.md`, `GOTCHAS.md`, `GEMINI.md`) | None | DONE |
| 3 | Ticket C | Infra Scripts Hardening (`bootstrap.js`, `check-infra.js`, `upgrade-infra.js` fixes) | None | DONE |
| 4 | Re-sync & Verify | Regenerate baseline hashes and run all validation scripts / test cases | M1, M2, M3 | DONE |

## Interface Contracts
### Scripts ↔ Environment
- `bootstrap.js` must check `process.stdin.isTTY` at start of `main()` and abort with code 1 if non-interactive.
- `upgrade-infra.js` must abort / default to 'n' if `process.stdin.isTTY` is false.
- `upgrade-infra.js` must clean up `.agentic-temp-clone` upon receiving SIGINT/SIGTERM.
- `check-infra.js` and `upgrade-infra.js` must handle Windows drive letters case-insensitively in `isPathContained`.

## Code Layout
- `scripts/bootstrap.js` - Bootstraps development environment, git hooks, and file hashing.
- `scripts/check-infra.js` - Runs infrastructure checks against baselines.
- `scripts/upgrade-infra.js` - Syncs infrastructure files with central repo (WARNING: do not run `--force` locally to avoid overwriting fixes).
- `.cursor/rules/auth.mdc` - Middleware and auth rules.
- `.cursor/rules/database.mdc` - Database design and query helper rules.
