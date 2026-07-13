#!/usr/bin/env node

/**
 * Copies the main checkout's .env.local (and .env.development.local, if
 * present) into the current git worktree (worktrees under
 * .claude/worktrees/ don't inherit untracked env files, so `npm run dev`
 * fails there with "supabaseUrl is required").
 *
 * Refuses to overwrite an existing file of either name in the worktree.
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
} else {
  fs.copyFileSync(source, dest)
  console.log(`env:worktree: copied ${source} -> ${dest}`)
}

const devLocalSource = path.join(mainRoot, '.env.development.local')
const devLocalDest = path.join(cwd, '.env.development.local')
const devLocalSourceExists = fs.existsSync(devLocalSource)

if (devLocalSourceExists && fs.existsSync(devLocalDest)) {
  console.log(
    'env:worktree: .env.development.local already exists in this worktree — leaving it untouched.',
  )
} else if (devLocalSourceExists) {
  fs.copyFileSync(devLocalSource, devLocalDest)
  console.log(`env:worktree: copied ${devLocalSource} -> ${devLocalDest}`)
}

if (devLocalSourceExists) {
  console.log(
    '\nenv:worktree: this worktree targets the hosted Supabase DEV project (#563) via\n' +
      '  .env.development.local — safe for normal local writes. Shared, mutable DB: other\n' +
      '  machines/sessions can see and change the same data.',
  )
} else {
  console.warn(
    '\n⚠  WARNING: no .env.development.local found — .env.local alone contains PRODUCTION\n' +
      '   credentials (Supabase service-role key). Local dev writes hit live data.\n' +
      '   Run: cp .env.example .env.development.local in the main checkout and point it at\n' +
      '   the DEV project (iymwxdewcpvpjgzewtzk), or navigation-only testing until you do.',
  )
}
console.warn('   Never commit or share these files (.env* is gitignored — keep it that way).')
