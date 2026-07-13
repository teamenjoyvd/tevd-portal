#!/usr/bin/env node

/**
 * Validates that every variable listed in .env.example is available,
 * reading .env.local directly (plain `node` does not auto-load env files —
 * the PR #544 version checked process.env only and always failed).
 *
 * Sources, in order: .env.development.local (the local-Supabase override
 * `next dev` loads with highest priority — see docs/DEV_WORKFLOW.md), then
 * .env.local, then process.env (CI/exported shells).
 * Empty values count as missing. Prints missing names only, never values —
 * except the effective NEXT_PUBLIC_SUPABASE_URL host, reported so you always
 * know whether dev targets the local stack or a remote (production) project.
 *
 * Vars listed below a `# --- optional ---` line in .env.example only warn.
 */

const fs = require('fs')
const path = require('path')

const root = process.cwd()

const OPTIONAL_DIVIDER = /^\s*#\s*-+\s*optional\s*-+/i

function parseEnvFile(filePath) {
  const vars = {}
  const content = fs.readFileSync(filePath, 'utf8')
  let optionalSection = false
  for (const line of content.split(/\r?\n/)) {
    if (OPTIONAL_DIVIDER.test(line)) {
      optionalSection = true
      continue
    }
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match === null) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    vars[match[1]] = { value, optional: optionalSection }
  }
  return vars
}

const examplePath = path.join(root, '.env.example')
if (!fs.existsSync(examplePath)) {
  console.error(`check:env: ${examplePath} not found — run from the project root.`)
  process.exit(1)
}
const example = parseEnvFile(examplePath)
const required = Object.keys(example).filter((name) => !example[name].optional)
const optional = Object.keys(example).filter((name) => example[name].optional)

const localPath = path.join(root, '.env.local')
let localVars = {}
if (fs.existsSync(localPath)) {
  localVars = parseEnvFile(localPath)
} else {
  console.warn(
    'check:env: .env.local not found — checking process.env only.\n' +
      '  Fresh clone: cp .env.example .env.local and fill in values.\n' +
      '  Git worktree: npm run env:worktree',
  )
}

// `next dev` loads .env.development.local with higher priority than .env.local,
// so mirror that here (it holds the local-Supabase override when present).
const devLocalPath = path.join(root, '.env.development.local')
let devLocalVars = {}
if (fs.existsSync(devLocalPath)) {
  devLocalVars = parseEnvFile(devLocalPath)
}

function effectiveValue(name) {
  const fromDev = devLocalVars[name]
  if (fromDev !== undefined && fromDev.value !== '') return fromDev.value
  const fromFile = localVars[name]
  if (fromFile !== undefined && fromFile.value !== '') return fromFile.value
  const fromEnv = process.env[name]
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  return null
}

function isMissing(name) {
  return effectiveValue(name) === null
}

const missingRequired = required.filter(isMissing)
const missingOptional = optional.filter(isMissing)

if (missingOptional.length > 0) {
  console.warn('check:env: optional variables not set (app falls back to defaults):')
  for (const name of missingOptional) console.warn(`  - ${name}`)
}

if (missingRequired.length > 0) {
  console.error('check:env: missing required environment variables:')
  for (const name of missingRequired) console.error(`  - ${name}`)
  process.exit(1)
}

console.log(`check:env: all ${required.length} required variables are set.`)

// Report which Supabase project dev will actually hit (host only, never keys).
const supabaseUrl = effectiveValue('NEXT_PUBLIC_SUPABASE_URL')
if (supabaseUrl !== null) {
  let host = supabaseUrl
  try {
    host = new URL(supabaseUrl).host
  } catch {
    // leave as-is if unparsable; check above already guarantees non-empty
  }
  const isLocal = /^(127\.0\.0\.1|localhost)(:|$)/.test(host)
  if (isLocal) {
    console.log(`check:env: Supabase target = LOCAL stack (${host}).`)
  } else {
    console.warn(
      `check:env: Supabase target = REMOTE project (${host}) — local dev writes hit that database.\n` +
        '  For the local Docker stack, create .env.development.local (docs/DEV_WORKFLOW.md "Local Supabase stack").',
    )
  }
}
