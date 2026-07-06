# AGENTS.md — rules pointer for non-Claude agents (Antigravity, Gemini, Cursor)

Governing ruleset: read `CLAUDE.md` in full — routing table, iron rules, `## Project` (constants + Hard Constraints), and `## Hard stops`. It is the single source of law for every agent working in this repo. This file is a pointer only; never duplicate rules from `CLAUDE.md` here.

- Project workflow (SSU / PLAN / CLAIM / BUILD / GCR), ID format, issue labels, CLAIM-complete definition: `docs/guardrails/PROJECT.md`
- Sharp edges: `docs/ai/GOTCHAS.md` — read in full at SHAPE and GATHER
- Reference tables (schema, routes, design system, env vars): `docs/ai/REF.md` — sections on demand at GATHER
- Architecture: `docs/architecture/` (C4.md, FLOWS.md, DECISIONS.md)
- Multi-agent coexistence: `docs/guardrails/PROJECT.md#multi-agent-coexistence` — the PR `## Session State` block is the sole cross-agent handoff.
