# Weekly cleanup

One pass a week (e.g. Monday) keeps agent-session churn from accumulating. Baseline set by the 2026-07-19 cleanup (issue #585): 13 stale local branches, 5 orphaned worktree dirs (~several GB of node_modules), 264 `.agents/` scratch files, 4 stashes.

## The commands

```bash
npm run clean:weekly            # dry-run: full report, deletes nothing
npm run clean:weekly -- --apply # delete the two safe categories
```

`scripts/clean-weekly.mjs` deletes **only** (and only with `--apply`):

1. **Local branches** provably merged — ancestry-merged into `origin/main`, or with a `gh`-confirmed MERGED pull request (covers squash merges). Never `main`, the current branch, or anything checked out in a worktree.
2. **Orphaned worktree directories** — dirs under `.claude/worktrees/` not registered in `git worktree list` — then `git worktree prune`.

Everything else is **report-only**: stashes, `docs/CLAIMS.md` rows, build-cache sizes, remote branches. Windows note: a dir can survive `--apply` as an empty shell if another process holds a handle on it (e.g. a live agent session's shell cwd) — it will go on a later run.

## Manual items (the script never touches these)

- **Stashes** — review each reported stash (`git stash show -p stash@{n}`), drop deliberately. Anything older than a couple of weeks is usually churn (package-lock diffs, bookkeeping).
- **CLAIMS.md rows** — remove rows whose PR merged or branch was abandoned (per the rules in `docs/CLAIMS.md` itself).
- **Remote branches** — deleting them is a push; do it via GitHub UI/PR merge auto-delete, not from a script.
- **`git gc`** — occasionally (monthly is plenty), after stashes are settled, to prune unreachable objects.
- **`~/.claude/projects` session transcripts** — grow unbounded (≈100 MB observed at ~36 session dirs). Recommendation: archive or delete transcript dirs older than 30 days by hand; no automation, they're outside the repo and may hold context you still want.
- **Docker / local Supabase stack** — user-run only, never scripted (`docs/STATE.md` constraint): `supabase stop` + `docker system prune` when you decide.

## Why some junk can't return

- `.agents/` is now gitignored — orchestration scratch never shows up as untracked noise again.
- One-off root scripts (`convert.js`, `test_out.txt`-style dumps) still can; the dry-run's untracked report in `git status` is your tripwire — delete them at the weekly pass.
