# Archived agent docs — 2026-07-12 streamline

Archived during the agent-instruction infrastructure streamline (Claude-only consolidation).
Nothing here is live. Canonical surfaces after this pass: `CLAUDE.md` (law), `docs/guardrails/`
(kit + PROJECT.md), `docs/ai/` (BUILD/CLAIM/PLAN/GCR workflows, REF, GOTCHAS, REFACTOR).

| File | Was | Why archived |
|---|---|---|
| `PROJECT-NOTES.md` | `docs/guardrails/PROJECT-NOTES.md` | Verbatim point-in-time copy of the living `docs/ai/REFACTOR.md` |
| `MIGRATION-LOG.md` | `docs/guardrails/MIGRATION-LOG.md` | Historical record of the 2026-07-06 guardrails-kit migration |
| `QA.md` | `docs/ai/QA.md` | Stale Q&A/todo backlog; live items surfaced as GitHub issue candidates |
| `GEMINI.md` | `docs/ai/GEMINI.md` | Gemini/Antigravity agent persona — project is Claude-only now |
| `CONTEXT.md` | `docs/ai/CONTEXT.md` | Gutted pointer doc; its §4 CI content moved to `docs/ai/REF.md` §12 |
| `multi-agent-coexistence.md` | `docs/guardrails/PROJECT.md` section | Antigravity coexistence rules — retired with the multi-agent workflow |
| `auth.mdc`, `database.mdc`, `frontend.mdc` | `.cursor/rules/` | Cursor retired; content duplicated CLAUDE.md/GOTCHAS/PROJECT.md (database.mdc's unique ADR-011 warning moved to GOTCHAS.md) |
| `bootstrap.js`, `handoff.js`, `smoke.js`, `check-infra.js`, `upgrade-infra.js` | `scripts/` | Upstream agentic-kit sync tooling, retired (hash pinning removed from `agentic.config.json`); `scripts/validate-rules.js` kept — it checks real code constraints |
