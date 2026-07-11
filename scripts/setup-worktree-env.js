#!/usr/bin/env node

/**
 * Copies the main checkout's .env.local into the current git worktree
 * (worktrees under .claude/worktrees/ don't inherit untracked env files,
 * so `npm run dev` fails there with "supabaseUrl is required").
 *
 * Refuses to overwrite an existing .env.local in the worktree.
 */

const fs = require('fs')
const path = require('path')

const cwd = process.cwd()
const segments = cwd.split(path.sep)
const marker = segments.findIndex(
  (seg, i) => seg === '.claude' && segments[i + 1] === 'worktrees',
)

if (marker === -1) {
  console.error(
    'env:worktree: current directory is not inside a .claude/worktrees worktree.\n' +
      `  cwd: ${cwd}\n` +
      '  In the main checkout, create .env.local from .env.example instead.',
  )
  process.exit(1)
}

const mainRoot = segments.slice(0, marker).join(path.sep)
const source = path.join(mainRoot, '.env.local')
const dest = path.join(cwd, '.env.local')

if (!fs.existsSync(source)) {
  console.error(
    `env:worktree: ${source} not found — the main checkout has no .env.local to copy.`,
  )
  process.exit(1)
}

if (fs.existsSync(dest)) {
  console.log('env:worktree: .env.local already exists in this worktree — leaving it untouched.')
  console.log('  Delete it first if you want a fresh copy.')
  process.exit(0)
}

fs.copyFileSync(source, dest)
console.log(`env:worktree: copied ${source} -> ${dest}`)
console.warn(
  '\n⚠  WARNING: this file contains PRODUCTION credentials (Supabase service-role key).\n' +
    '   Local dev writes hit live data until #547 (local Supabase) lands:\n' +
    '   navigation-only testing — no form submits, no mutations, no destructive experiments.\n' +
    '   Never commit or share this file (.env* is gitignored — keep it that way).',
)
