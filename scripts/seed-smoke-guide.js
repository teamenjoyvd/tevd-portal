#!/usr/bin/env node

/**
 * Seeds one stable, guest-visible published guide for the preview-smoke
 * click-through flow (e2e/library-guide.spec.ts): guest opens /library,
 * clicks this guide's card, and lands on /library/<slug>.
 *
 * Idempotent: upserts on the fixed slug, so re-running never accumulates
 * rows. Re-run after any DEV re-mirror from prod (which drops this row).
 *
 * SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at a local
 * instance (127.0.0.1/localhost) or the hosted DEV project
 * (iymwxdewcpvpjgzewtzk) — this must never write to prod/preview Supabase.
 * (Mirrors scripts/seed-clerk-test-users.js.)
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Plain `node` does not auto-load env files — mirrors scripts/seed-clerk-test-users.js.
// Loaded in Next.js precedence order: .env.development.local first (higher
// priority — already-set vars are never overwritten), then .env.local.
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath) === false) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match === null) continue
    let value = match[2]
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[match[1]] === undefined) process.env[match[1]] = value
  }
}

const root = process.cwd()
loadEnvFile(path.join(root, '.env.development.local'))
loadEnvFile(path.join(root, '.env.local'))

const { isSafeSupabaseTarget } = require('./lib/safe-supabase-target')

// Kept in sync with e2e/library-guide.spec.ts (SMOKE_GUIDE_SLUG).
const SMOKE_GUIDE_SLUG = 'e2e-smoke-guide'

// Minimal valid Tiptap JSONContent doc — the detail page runs generateHTML()
// over body_en, which must not throw on a malformed node tree.
function tiptapDoc(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

const SMOKE_GUIDE = {
  slug: SMOKE_GUIDE_SLUG,
  title: { en: 'E2E Smoke Guide', bg: 'E2E Smoke Guide' },
  body_en: tiptapDoc('Fixture guide for the preview-smoke click-through. Safe to leave in DEV.'),
  body_bg: tiptapDoc('Fixture guide for the preview-smoke click-through. Safe to leave in DEV.'),
  access_roles: ['guest', 'member', 'core', 'admin'],
  is_published: true,
}


async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (isSafeSupabaseTarget(supabaseUrl) === false) {
    console.error(
      `seed-smoke-guide: refusing to run — NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") ` +
        'is not a local instance or the hosted DEV project. This script must never write to prod/preview Supabase.',
    )
    process.exitCode = 1
    return
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey === undefined || serviceRoleKey === '') {
    console.error('seed-smoke-guide: SUPABASE_SERVICE_ROLE_KEY is not set.')
    process.exitCode = 1
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { error } = await supabase
    .from('guides')
    .upsert(SMOKE_GUIDE, { onConflict: 'slug' })
  if (error !== null) throw new Error(`guides upsert failed for ${SMOKE_GUIDE_SLUG}: ${error.message}`)
  console.log(`seed-smoke-guide: ready — /library/${SMOKE_GUIDE_SLUG} (guest-visible, published)`)
}

main().catch((err) => {
  console.error('seed-smoke-guide: failed —', err)
  process.exitCode = 1
})
