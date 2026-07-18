#!/usr/bin/env node
/**
 * Weekly repo hygiene — see docs/WEEKLY_CLEANUP.md for the full process.
 *
 *   npm run clean:weekly            # dry-run: report everything, delete nothing
 *   npm run clean:weekly -- --apply # delete the two safe categories below
 *
 * Deletes (only with --apply):
 *   1. Local branches whose tip is reachable from origin/main (ancestry-merged),
 *      or whose PR is confirmed MERGED via `gh` (covers squash merges).
 *      Never: main, the current branch, or a branch checked out in any worktree.
 *   2. Unregistered directories under .claude/worktrees/ (orphaned worktree
 *      leftovers — not listed by `git worktree list`), then `git worktree prune`.
 *
 * Reports only (NEVER deletes): stashes, docs/CLAIMS.md rows, build caches,
 * remote branches. Docker/Supabase teardown is user-run only, never scripted
 * (docs/STATE.md constraint) — this script does not touch either.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: repoRoot })
}
function tryGh(...args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', cwd: repoRoot }).trim()
  } catch {
    return null // gh missing or offline — callers degrade to report-only
  }
}
function header(title) {
  console.log(`\n== ${title} ==`)
}

console.log(`clean-weekly — ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply to delete)'} — ${repoRoot}`)

try {
  git('fetch', '--prune')
} catch (e) {
  console.warn(`WARN: git fetch --prune failed (offline?): ${e.message.split('\n')[0]} — continuing with stale remote refs`)
}

// ---- 1. Local branches -----------------------------------------------------
header('Local branches')
const current = git('branch', '--show-current').trim()
const checkedOut = new Set(
  git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((l) => l.startsWith('branch refs/heads/'))
    .map((l) => l.slice('branch refs/heads/'.length))
)
const ancestryMerged = new Set(
  git('branch', '--merged', 'origin/main', '--format=%(refname:short)')
    .split('\n').map((s) => s.trim()).filter((s) => s !== '')
)
const allBranches = git('branch', '--format=%(refname:short)\t%(upstream:track)')
  .split('\n').map((s) => s.trim()).filter((s) => s !== '')

const deletable = []
for (const line of allBranches) {
  const [name, track] = line.split('\t')
  if (name === 'main' || name === current || checkedOut.has(name)) continue
  if (ancestryMerged.has(name)) {
    deletable.push({ name, reason: 'merged into origin/main' })
    continue
  }
  // Squash merges are invisible to --merged; upstream "[gone]" or no upstream
  // at all means the remote side is finished or never existed — ask gh.
  const prState = tryGh('pr', 'list', '--head', name, '--state', 'merged', '--json', 'number', '--jq', '.[0].number')
  if (prState !== null && prState !== '') {
    deletable.push({ name, reason: `PR #${prState} merged (squash)` })
  } else {
    console.log(`  keep:   ${name}${track ? ' ' + track : ''} — not merged (or gh unavailable to confirm)`)
  }
}
for (const b of deletable) {
  if (APPLY) {
    git('branch', '-D', b.name)
    console.log(`  DELETED ${b.name} — ${b.reason}`)
  } else {
    console.log(`  delete: ${b.name} — ${b.reason}`)
  }
}
if (deletable.length === 0) console.log('  nothing to delete')

// ---- 2. Orphaned worktree directories -------------------------------------
header('Worktrees (.claude/worktrees)')
const wtDir = path.join(repoRoot, '.claude', 'worktrees')
const registered = new Set(
  git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => path.resolve(l.slice('worktree '.length)))
)
let orphans = []
if (existsSync(wtDir)) {
  orphans = readdirSync(wtDir)
    .map((d) => path.join(wtDir, d))
    .filter((p) => statSync(p).isDirectory() && !registered.has(path.resolve(p)))
}
for (const p of orphans) {
  if (APPLY) {
    try {
      rmSync(p, { recursive: true, force: true })
      console.log(`  DELETED ${p}`)
    } catch (e) {
      console.warn(`  FAILED to delete ${p}: ${e.message.split('\n')[0]} (file lock? retry after closing editors)`)
    }
  } else {
    console.log(`  delete: ${p} (unregistered — orphaned worktree dir)`)
  }
}
if (orphans.length === 0) console.log('  no orphaned worktree dirs')
if (APPLY) git('worktree', 'prune')

// ---- 3. Report-only sections ----------------------------------------------
header('Stashes (report only — drop manually after review)')
const stashes = git('stash', 'list', '--format=%gd\t%cr\t%s').split('\n').filter(Boolean)
if (stashes.length === 0) console.log('  none')
for (const s of stashes) console.log(`  ${s.replaceAll('\t', '  ')}`)

header('docs/CLAIMS.md rows (report only — remove rows whose PR merged)')
const claimsPath = path.join(repoRoot, 'docs', 'CLAIMS.md')
if (existsSync(claimsPath)) {
  const rows = readFileSync(claimsPath, 'utf8')
    .split('\n')
    .filter((l) => /^\|\s*#\d+/.test(l))
  if (rows.length === 0) console.log('  no active claims')
  for (const row of rows) {
    const branch = row.match(/`([^`]+)`/)?.[1]
    const branchExists = branch
      ? git('branch', '--list', '--all', branch, `origin/${branch}`).trim() !== ''
      : false
    console.log(`  ${row.split('|').slice(1, 3).join(' ').trim()}${branchExists ? '' : ' — STALE? branch not found locally or on origin'}`)
  }
} else {
  console.log('  docs/CLAIMS.md not found')
}

header('Build caches (report only — safe to delete by hand, they regenerate)')
for (const rel of ['.next', 'tsconfig.tsbuildinfo']) {
  const p = path.join(repoRoot, rel)
  if (!existsSync(p)) continue
  const st = statSync(p)
  const size = st.isDirectory() ? dirSizeMB(p) : (st.size / 1e6).toFixed(1)
  console.log(`  ${rel}: ~${size} MB`)
}
function dirSizeMB(dir) {
  let bytes = 0
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch { return } // dir vanished mid-walk; skip it, keep counting the rest
    for (const e of entries) {
      const p = path.join(d, e.name)
      try {
        if (e.isDirectory()) walk(p)
        else if (e.isFile()) bytes += statSync(p).size
      } catch { /* file vanished mid-walk; skip it, keep counting the rest */ }
    }
  }
  walk(dir)
  return (bytes / 1e6).toFixed(0)
}

console.log(`\n${APPLY ? 'Apply pass complete.' : 'Dry-run complete — re-run with: npm run clean:weekly -- --apply'}`)
