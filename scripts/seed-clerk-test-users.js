#!/usr/bin/env node

/**
 * Seeds two Clerk test-instance users (member, admin) for the authenticated
 * Playwright suite (e2e/admin-auth.spec.ts) and upserts matching `profiles`
 * rows into Supabase so `getCallerContext` (lib/supabase/guards.ts) resolves
 * their role.
 *
 * Idempotent: looks up each user by email before creating. Users are created
 * with skipPasswordRequirement — the suite signs in via Clerk's ticket
 * strategy (@clerk/testing's `clerk.signIn({ emailAddress })`), never a
 * password, so none is generated or stored.
 *
 * SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL points at a local
 * instance (127.0.0.1/localhost) or the hosted DEV project
 * (iymwxdewcpvpjgzewtzk) — this must never write to prod/preview Supabase.
 */

const fs = require('fs')
const path = require('path')
const { createClerkClient } = require('@clerk/backend')
const { createClient } = require('@supabase/supabase-js')

// Plain `node` does not auto-load env files — mirrors scripts/check-env.js.
// Loaded in Next.js precedence order: .env.development.local first (higher
// priority — already-set vars are never overwritten), then .env.local.
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
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

// Clerk's email validator rejects the .test TLD (RFC 2606) — example.com passes.
const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL || 'e2e-member-tevd-portal@example.com'
const ADMIN_EMAIL = process.env.E2E_CLERK_ADMIN_EMAIL || 'e2e-admin-tevd-portal@example.com'

// abo_number: trg_guard_abo_number_null (20260716000100_normalize_prod_schema_drift.sql)
// rejects a NULL abo_number on a primary profile with role member or core. Admin is
// exempt by design there ("ops role, no LOS identity"), so it stays NULL. The value is
// text and UNIQUE (baseline.sql:31,47) with no format check. The reserved-looking
// string will not collide with a real ABO number, but uniqueness is NOT guaranteed
// on the hosted DEV project this script also targets: a stale fixture row (same
// email re-created in Clerk after a wipe, hence a new clerk_id) would still hold
// this value, and `onConflict: 'clerk_id'` does not resolve a violation of the
// separate profiles_abo_number_key constraint. assertAboNumberFree() below turns
// that into an actionable error instead of a raw constraint failure.
// `??` not `||`: an explicitly-empty E2E_CLERK_MEMBER_ABO must not be silently
// swapped for the default. It is rejected in main() instead — the DB trigger only
// rejects NULL, so a blank string would otherwise be inserted as a real value.
const MEMBER_ABO = process.env.E2E_CLERK_MEMBER_ABO ?? 'E2E-MEMBER-0001'

const TEST_USERS = [
  { email: MEMBER_EMAIL, role: 'member', firstName: 'E2E', lastName: 'Member', aboNumber: MEMBER_ABO },
  { email: ADMIN_EMAIL, role: 'admin', firstName: 'E2E', lastName: 'Admin', aboNumber: null },
]

const DEV_PROJECT_REF = 'iymwxdewcpvpjgzewtzk'

function isSafeSupabaseTarget(url) {
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) return true
  return url.includes(DEV_PROJECT_REF)
}

async function ensureClerkUser(clerk, { email, role, firstName, lastName }) {
  const existing = await clerk.users.getUserList({ emailAddress: [email] })
  if (existing.data.length > 0) return existing.data[0]

  return clerk.users.createUser({
    emailAddress: [email],
    firstName,
    lastName,
    skipPasswordRequirement: true,
    publicMetadata: { role },
  })
}

// profiles.abo_number is UNIQUE, but the upsert below conflict-resolves on clerk_id
// only — a row holding this abo_number under a DIFFERENT clerk_id raises a raw
// constraint error naming neither the fixture nor the remedy. Check first and fail
// with something actionable. Read-only: never mutate a row this script does not own
// (and nulling the holder's abo_number would itself trip trg_guard_abo_number_null).
async function assertAboNumberFree(supabase, clerkId, aboNumber, email) {
  if (aboNumber == null) return

  const { data, error } = await supabase
    .from('profiles')
    .select('clerk_id')
    .eq('abo_number', aboNumber)
    .maybeSingle()

  if (error) throw new Error(`abo_number precheck failed for ${email}: ${error.message}`)
  if (data == null || data.clerk_id === clerkId) return

  throw new Error(
    `abo_number "${aboNumber}" (fixture for ${email}) is already held by profile ` +
      `clerk_id=${data.clerk_id}. This is a stale fixture from an earlier Clerk test ` +
      `instance. Clear or reassign that profile's abo_number, or set ` +
      `E2E_CLERK_MEMBER_ABO to a different reserved value.`,
  )
}

async function upsertProfile(supabase, clerkId, { role, firstName, lastName, email, aboNumber }) {
  await assertAboNumberFree(supabase, clerkId, aboNumber, email)

  const { error } = await supabase.from('profiles').upsert(
    {
      clerk_id: clerkId,
      first_name: firstName,
      last_name: lastName,
      role,
      abo_number: aboNumber ?? null,
      contact_email: email,
      display_names: { en: `${firstName} ${lastName}` },
    },
    { onConflict: 'clerk_id' },
  )
  if (error) throw new Error(`profiles upsert failed for ${email}: ${error.message}`)
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!isSafeSupabaseTarget(supabaseUrl)) {
    console.error(
      `seed-clerk-test-users: refusing to run — NEXT_PUBLIC_SUPABASE_URL ("${supabaseUrl}") ` +
        'is not a local instance or the hosted DEV project. This script must never write to prod/preview Supabase.',
    )
    process.exitCode = 1
    return
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secretKey) {
    console.error('seed-clerk-test-users: CLERK_SECRET_KEY is not set.')
    process.exitCode = 1
    return
  }
  if (!serviceRoleKey) {
    console.error('seed-clerk-test-users: SUPABASE_SERVICE_ROLE_KEY is not set.')
    process.exitCode = 1
    return
  }
  if (MEMBER_ABO.trim() === '') {
    console.error(
      'seed-clerk-test-users: E2E_CLERK_MEMBER_ABO is set but empty. Unset it to use the ' +
        'default fixture value, or give it a real reserved value — a blank abo_number would ' +
        'satisfy the NOT NULL trigger and be stored as a real one.',
    )
    process.exitCode = 1
    return
  }

  const clerk = createClerkClient({ secretKey })
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  for (const testUser of TEST_USERS) {
    const clerkUser = await ensureClerkUser(clerk, testUser)
    await upsertProfile(supabase, clerkUser.id, testUser)
    console.log(`seed-clerk-test-users: ${testUser.role} ready — ${testUser.email} (${clerkUser.id})`)
  }
}

main().catch((err) => {
  console.error('seed-clerk-test-users: failed —', err)
  process.exitCode = 1
})
