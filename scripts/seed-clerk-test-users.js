#!/usr/bin/env node

/**
 * Seeds two Clerk test-instance users (member, admin) for the authenticated
 * Playwright suite (e2e/admin-auth.spec.ts) and upserts matching `profiles`
 * rows into Supabase so `getCallerContext` (lib/supabase/guards.ts) resolves
 * their role.
 *
 * Also seeds the fixture e2e/payments-on-behalf.spec.ts needs to run at all:
 * a DOWNLINE profile under the member (plus the tree_nodes rows that make it
 * visible to `get_payable_beneficiaries`) and one ACTIVE payable item. Without
 * both, that spec self-skips at its `count === 0` guard rather than passing
 * vacuously, so the #676 happy path is never exercised. The downline never
 * signs in, so it gets no Clerk user — only a profiles row.
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

// The downline fixture. Same reserved-value reasoning and the same
// assertAboNumberFree precheck as MEMBER_ABO above.
//
// It MUST carry a real abo_number, not NULL: the picker row renders
// `{abo_number ? `${abo} · ` : ''}{relation}` (components/payment/BeneficiaryPicker.tsx:168)
// and the spec selects candidates with `.filter({ hasText: /·/ })`
// (e2e/payments-on-behalf.spec.ts:57). An ABO-less co-owner would be a valid
// beneficiary the spec's locator could not see.
//
// clerk_id is synthetic and reserved. profiles.clerk_id is NOT NULL UNIQUE
// (baseline.sql:30,48) and nothing here ever hands it to Clerk — this profile
// exists only to be paid FOR.
const DOWNLINE_CLERK_ID = 'seed_e2e_downline_tevd_portal'
const DOWNLINE_ABO = process.env.E2E_CLERK_DOWNLINE_ABO ?? 'E2E-DOWNLINE-0001'

// The generic payment form always renders its item <select>, so with no active
// payable item the only options are the placeholder and nothing — which the
// spec treats as an unusable environment and skips
// (e2e/payments-on-behalf.spec.ts:100). One active item is the minimum.
const PAYABLE_ITEM_TITLE = 'E2E Test Fee'

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

// Returns the profile id — the downline fixture below needs both the member's
// and the admin's, and re-selecting them afterwards would be a second round trip
// that can disagree with what was just written.
async function upsertProfile(supabase, clerkId, { role, firstName, lastName, email, aboNumber }) {
  await assertAboNumberFree(supabase, clerkId, aboNumber, email)

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
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
    .select('id')
    .single()
  if (error) throw new Error(`profiles upsert failed for ${email}: ${error.message}`)
  return data.id
}

// `get_payable_beneficiaries` finds a downline through `tree_nodes.path <@ <viewer
// path>` — a profiles row alone is invisible to the picker, so both ends need a
// node. upsert_tree_node(p_profile_id uuid, p_abo_number text, p_sponsor_abo_number
// text DEFAULT NULL) is the only writer of that table's path/depth arithmetic
// (baseline.sql:393-461); recomputing ltree paths here would be a second,
// drifting definition.
async function ensureTreeNode(supabase, profileId, aboNumber, sponsorAboNumber, label) {
  // Only plant a node when the profile has none. On the hosted DEV project the
  // member may already sit under a real sponsor, and re-running with a NULL
  // sponsor would silently REPARENT them to a root — this script must never
  // mutate LOS shape it did not create.
  const { data: existing, error: readError } = await supabase
    .from('tree_nodes')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle()
  if (readError) throw new Error(`tree_nodes lookup failed for ${label}: ${readError.message}`)
  if (existing != null) return false

  const { error } = await supabase.rpc('upsert_tree_node', {
    p_profile_id: profileId,
    p_abo_number: aboNumber,
    p_sponsor_abo_number: sponsorAboNumber,
  })
  if (error) throw new Error(`upsert_tree_node failed for ${label}: ${error.message}`)
  return true
}

// payable_items has no natural unique key, so guard on title — the same shape
// supabase/seed.sql uses for its sample trip.
async function ensurePayableItem(supabase, createdByProfileId) {
  const { data: existing, error: readError } = await supabase
    .from('payable_items')
    .select('id')
    .eq('title', PAYABLE_ITEM_TITLE)
    .maybeSingle()
  if (readError) throw new Error(`payable_items lookup failed: ${readError.message}`)
  if (existing != null) return false

  const { error } = await supabase.from('payable_items').insert({
    title: PAYABLE_ITEM_TITLE,
    amount: 100,
    currency: 'EUR',
    item_type: 'other',
    is_active: true,
    created_by: createdByProfileId,
  })
  if (error) throw new Error(`payable_items insert failed: ${error.message}`)
  return true
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
  if (DOWNLINE_ABO.trim() === '') {
    console.error(
      'seed-clerk-test-users: E2E_CLERK_DOWNLINE_ABO is set but empty. Same reason as ' +
        'E2E_CLERK_MEMBER_ABO above — unset it or give it a real reserved value.',
    )
    process.exitCode = 1
    return
  }
  if (DOWNLINE_ABO === MEMBER_ABO) {
    console.error(
      'seed-clerk-test-users: E2E_CLERK_DOWNLINE_ABO equals E2E_CLERK_MEMBER_ABO. ' +
        'profiles.abo_number is UNIQUE, so the two fixtures cannot share one.',
    )
    process.exitCode = 1
    return
  }

  const clerk = createClerkClient({ secretKey })
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const profileIdByRole = {}
  for (const testUser of TEST_USERS) {
    const clerkUser = await ensureClerkUser(clerk, testUser)
    profileIdByRole[testUser.role] = await upsertProfile(supabase, clerkUser.id, testUser)
    console.log(`seed-clerk-test-users: ${testUser.role} ready — ${testUser.email} (${clerkUser.id})`)
  }

  // ── on-behalf fixture (e2e/payments-on-behalf.spec.ts) ──────────────────────
  // The member anchors the leg, so its node must exist before the downline can
  // be hung off it by ABO.
  const memberProfileId = profileIdByRole.member
  const planted = await ensureTreeNode(supabase, memberProfileId, MEMBER_ABO, null, MEMBER_EMAIL)
  console.log(
    planted
      ? `seed-clerk-test-users: member tree node planted at root (${MEMBER_ABO})`
      : 'seed-clerk-test-users: member already has a tree node — left as is',
  )

  const downlineProfileId = await upsertProfile(supabase, DOWNLINE_CLERK_ID, {
    role: 'member',
    firstName: 'E2E',
    lastName: 'Downline',
    // Stored as contact_email only; there is no Clerk user behind it, so it is
    // never a sign-in identity. Present so the precheck errors below name
    // something a human can search for.
    email: 'e2e-downline-tevd-portal@example.com',
    aboNumber: DOWNLINE_ABO,
  })
  await ensureTreeNode(supabase, downlineProfileId, DOWNLINE_ABO, MEMBER_ABO, DOWNLINE_CLERK_ID)
  console.log(`seed-clerk-test-users: downline ready — ${DOWNLINE_ABO} under ${MEMBER_ABO}`)

  const created = await ensurePayableItem(supabase, profileIdByRole.admin)
  console.log(
    created
      ? `seed-clerk-test-users: payable item created — "${PAYABLE_ITEM_TITLE}"`
      : `seed-clerk-test-users: payable item "${PAYABLE_ITEM_TITLE}" already exists`,
  )
}

main().catch((err) => {
  console.error('seed-clerk-test-users: failed —', err)
  process.exitCode = 1
})
