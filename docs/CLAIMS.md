# CLAIMS.md — in-flight work registry

Checked at CLAIM time (see `docs/guardrails/PROJECT.md` Workflow commands) before a branch is cut, to catch two agents independently solving the same problem on overlapping scope (e.g. PR #538 and 2607-DEV-535 both adding a debounce to the same search input, discovered only at merge). Add a row when CLAIM completes; remove the row when the PR merges or the branch is abandoned.

**Race window (known limitation):** this is a plain markdown file, not a lock — reading it, checking for overlap, and adding a row are three separate, non-atomic steps. Two agents can both read "no overlap" before either has committed their row. Mitigation, not a guarantee: `git pull` and re-read this file immediately before committing the new row (last step, right before the commit), so the window is only as wide as that final pull-and-check. If this repo's actual concurrent-agent volume ever makes that race a real recurring problem (not just theoretical), switch to a stronger primitive — e.g. GitHub issue assignment, which GitHub applies atomically server-side — instead of hardening this file further.

| Issue | Branch | Files/areas | Claimed at |
|---|---|---|---|
| #545 | `dev/2607-DEV-545` | root docs → docs/archive/, README.md (new), docs/DEV_WORKFLOW.md (new), .gitignore, supabase/config.toml (comments), supabase/.temp untrack, docs/STATE.md | 2026-07-11T13:00Z |
| #546 | `dev/2607-DEV-546` | package.json (deps/scripts), package-lock.json, next.config.ts, playwright.config.ts + e2e/ (new), scripts/check-env.js + scripts/setup-worktree-env.js (new), .claude/settings.json (new), .github/workflows/ci.yml + preview-smoke.yml | 2026-07-11T13:00Z |
| #552 | `dev/2607-DEV-552` | CLAUDE.md, AGENTS.md, README.md, docs/ai/* (BUILD/PLAN/GCR/REF/GOTCHAS/system-prompt), docs/guardrails/PROJECT.md, docs/archive/agent-docs-2026-07/ (new), .cursor/rules removal, scripts/ kit-sync removal, agentic.config.json, package.json (agentic:* scripts) | 2026-07-12T00:50Z |
