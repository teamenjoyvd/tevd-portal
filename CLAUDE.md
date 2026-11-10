@AGENTS.md

## Claude Code only

- **Hooks.** `.claude/settings.json` runs `scripts/claude-hooks/dispatch.js` before and after Write, Edit, Bash and GitHub MCP writes. It blocks `middleware.ts`, service-role key leaks into client code or `NEXT_PUBLIC_` vars, badly named migrations, migrations without `-- ROLLBACK:`, branch names outside `dev/[YYMM]-DEV-[GH#]` / `claude/*`, and pushes or GitHub MCP writes to `main`; it warns on commands naming the PROD project. A block is the rule working — fix the change, never the hook.
- **Delta.** The `delta@zed-industries` plugin is enabled for this project in `.claude/settings.json`, so it loads in every clone and worktree. Each checkout's sync choice lives in `.delta/settings.json` (git-ignored); run `/delta-setup` in a checkout that has none.
