# Multi-agent coexistence (retired 2026-07-12)

Extracted verbatim from `docs/guardrails/PROJECT.md` when the Antigravity multi-agent workflow was retired (project is Claude-only).

## Multi-agent coexistence

_Transported verbatim from `docs/ai/RULES.md` §4 (pre-migration). Live requirement: Claude + Antigravity operate on an identical 1:1 ruleset with shared session-state awareness._

- **Shared State Tracking:**
  - Antigravity and Claude.ai must align and synchronize on execution state.
  - Claude.ai should read the brain directory's `implementation_plan.md` to pick up prior research.
  - Antigravity must format its planning mode `implementation_plan.md` artifact to exactly match the `PLAN` output layout from `docs/ai/PLAN.md`.
  - PR descriptors must include an `Agent Type: Antigravity | Claude` tag in their session state block.

_Addendum (2026-07-06, guardrails review — clarifies how the transported rules above execute in practice):_
- The "brain directory" (`implementation_plan.md`, `task.md`) is Antigravity-internal workspace state outside this repo; Claude has no path to it and never reads it directly. Cross-agent state flows only through repo/GitHub artifacts.
- The PR `## Session State` block is the sole cross-agent handoff (per `docs/ai/BUILD.md`); Antigravity mirrors its plan into GitHub using the `docs/ai/PLAN.md` output layout, which satisfies the brain-directory sync intent.
- Since `docs/ai/RULES.md` was deleted (see `docs/guardrails/MIGRATION-LOG.md`), the shared 1:1 ruleset surface is `CLAUDE.md`; non-Claude agents load it via the root `AGENTS.md` pointer.
