# docs/archive — historical artifacts

Finished session/process artifacts moved out of the repo root during the 2026-07 dev-infrastructure refactor (#545). Content is preserved verbatim; nothing here is current guidance. Internal cross-references may point at old root paths — they are records, not living docs.

| Item | Was | What it is |
|---|---|---|
| `CONTEXT-2026-03.md` | `/README.md` | Pre-guardrails project context doc (March 2026). Superseded by the real `README.md`, `CLAUDE.md`, and `docs/`. Its git strategy ("push to main") predates the current hard constraints — do not follow it. |
| `notification-queue-project.md` | `/PROJECT.md` | Design doc for the (shipped) queue-based notification delivery system. |
| `ORIGINAL_REQUEST-2026-06.md` | `/ORIGINAL_REQUEST.md` | Verbatim user request from a June 2026 orchestration session. |
| `TEST_INFRA.md`, `TEST_READY.md` | repo root | Docs for the mock e2e suite driven by `scripts/run-e2e-tests.js` (`npm run test:mock` still works). |
| `release-cycle-test.md` | `docs/` | Smoke-test file used once (2026-04) to validate branch→preview→merge→deploy. |
| `agents-2026-06/` | `/.agents/` | Multi-agent orchestration workspace (briefings, handoffs, audits) from June 2026 sessions. Inert historical logs — see `docs/guardrails/MIGRATION-LOG.md`, which references them at their old `.agents/**` paths. |
