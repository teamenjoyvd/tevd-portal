import { test, expect, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { createClerkClient } from '@clerk/backend'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Authenticated end-to-end coverage of the CORE self-service LOS submission
 * feature. Requires the hosted DEV Supabase project + Clerk test instance
 * (env loaded by playwright.config.ts). Seeds throwaway namespaced fixtures
 * (ABOs 99000xx, three e2e users) and cleans them up afterwards.
 *
 * Covered: scope guard (root mismatch → 400), stage a pending submission,
 * withdraw, admin approve → import writes los_members + last_updated_by_abo,
 * upline attribution (senior CORE's import stamps a downline node), reject.
 */

const CORE_EMAIL   = 'e2e-core-tevd-portal@example.com'
const SENIOR_EMAIL = 'e2e-core-senior-tevd-portal@example.com'
const ADMIN_EMAIL  = process.env.E2E_CLERK_ADMIN_EMAIL ?? 'e2e-admin-tevd-portal@example.com'

// Throwaway namespaced ABOs — 9900000 (senior) → 9900001 (core) → 9900002 (child); 9900003 new.
const SENIOR = '9900000'
const CORE   = '9900001'
const CHILD  = '9900002'
const NEW    = '9900003'
const TEST_ABOS = [SENIOR, CORE, CHILD, NEW]

function svc(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function row(abo: string, sponsor: string, extra: Record<string, string> = {}) {
  return { abo_number: abo, sponsor_abo_number: sponsor, name: `T${abo}`, abo_level: '3', bonus_percent: '3', ...extra }
}

async function signInAs(page: Page, emailAddress: string) {
  await page.goto('/')
  // Tests switch users on the same page; Clerk refuses signIn while a session
  // is active, so sign out first (no-op / ignored when not signed in).
  await clerk.signOut({ page }).catch(() => {})
  await clerk.signIn({ page, emailAddress })
}

async function ensureUser(clerk: ReturnType<typeof createClerkClient>, email: string, role: string) {
  const existing = await clerk.users.getUserList({ emailAddress: [email] })
  if (existing.data.length > 0) return existing.data[0]
  return clerk.users.createUser({
    emailAddress: [email], firstName: 'E2E', lastName: role, skipPasswordRequirement: true, publicMetadata: { role },
  })
}

test.describe.configure({ mode: 'serial' })

test.describe('CORE LOS submission flow', () => {
  let sb: SupabaseClient
  let coreProfileId: string
  let seniorProfileId: string

  test.beforeAll(async () => {
    sb = svc()
    const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

    // Clerk users + profiles (CORE with abo, senior CORE with abo).
    const coreUser = await ensureUser(clerkClient, CORE_EMAIL, 'core')
    const seniorUser = await ensureUser(clerkClient, SENIOR_EMAIL, 'core')

    for (const [user, abo, email] of [[coreUser, CORE, CORE_EMAIL], [seniorUser, SENIOR, SENIOR_EMAIL]] as const) {
      await sb.from('profiles').upsert({
        clerk_id: user.id, first_name: 'E2E', last_name: 'Core', role: 'core',
        abo_number: abo, contact_email: email, display_names: { en: `E2E ${abo}` },
      }, { onConflict: 'clerk_id' })
    }

    coreProfileId = (await sb.from('profiles').select('id').eq('clerk_id', coreUser.id).single()).data!.id
    seniorProfileId = (await sb.from('profiles').select('id').eq('clerk_id', seniorUser.id).single()).data!.id

    // Baseline los_members subtree (existing state before uploads).
    await sb.from('los_members').upsert([
      { abo_number: SENIOR, sponsor_abo_number: null, name: 'T-Senior', abo_level: '3', bonus_percent: 3 },
      { abo_number: CORE,   sponsor_abo_number: SENIOR, name: 'T-Core',  abo_level: '3', bonus_percent: 3 },
      { abo_number: CHILD,  sponsor_abo_number: CORE,   name: 'T-Child', abo_level: '3', bonus_percent: 3 },
    ], { onConflict: 'abo_number' })

    await cleanupSubmissions()
  })

  test.afterAll(async () => {
    await cleanupSubmissions()
    await sb.from('los_members').delete().in('abo_number', TEST_ABOS)
    await sb.rpc('rebuild_tree_paths')
  })

  async function cleanupSubmissions() {
    await sb.from('los_submission_requests').delete().in('profile_id', [coreProfileId, seniorProfileId].filter(Boolean))
  }

  test('CORE upload with mismatched root is rejected 400', async ({ page }) => {
    await signInAs(page, CORE_EMAIL)
    // Rows rooted at SENIOR while signed in as CORE → mismatch.
    const res = await page.request.post('/api/profile/los-submission', {
      data: { rows: [row(SENIOR, ''), row(CORE, SENIOR), row(CHILD, CORE)] },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.reason).toBe('mismatch')
  })

  test('CORE upload with matching root is staged pending', async ({ page }) => {
    await signInAs(page, CORE_EMAIL)
    const res = await page.request.post('/api/profile/los-submission', {
      data: { rows: [row(CORE, SENIOR), row(CHILD, CORE), row(NEW, CORE)] },
    })
    expect(res.status()).toBe(200)
    const list = await (await page.request.get('/api/profile/los-submission')).json()
    const pending = list.submissions.filter((s: { status: string }) => s.status === 'pending')
    expect(pending).toHaveLength(1)
    expect(pending[0].root_abo_number).toBe(CORE)
  })

  test('CORE can withdraw own pending submission', async ({ page }) => {
    await signInAs(page, CORE_EMAIL)
    const list = await (await page.request.get('/api/profile/los-submission')).json()
    const pending = list.submissions.find((s: { status: string }) => s.status === 'pending')
    const res = await page.request.patch('/api/profile/los-submission', { data: { id: pending.id } })
    expect(res.status()).toBe(200)
    const after = await (await page.request.get('/api/profile/los-submission')).json()
    expect(after.submissions.find((s: { id: string }) => s.id === pending.id).status).toBe('withdrawn')
  })

  test('admin approves a CORE submission → import writes rows + owner', async ({ page }) => {
    // CORE re-submits.
    await signInAs(page, CORE_EMAIL)
    await page.request.post('/api/profile/los-submission', {
      data: { rows: [row(CORE, SENIOR), row(CHILD, CORE), row(NEW, CORE)] },
    })

    // Admin sees it and approves.
    await signInAs(page, ADMIN_EMAIL)
    const adminList = await (await page.request.get('/api/admin/los-submission')).json()
    const pending = adminList.submissions.find((s: { status: string; root_abo_number: string }) => s.status === 'pending' && s.root_abo_number === CORE)
    expect(pending).toBeTruthy()

    const res = await page.request.post('/api/admin/los-submission', { data: { action: 'approve', ids: [pending.id] } })
    expect(res.status()).toBe(200)
    const result = await res.json()
    expect(result.inserted).toBeGreaterThan(0)

    // DB: NEW node created; CHILD stamped as updated by its upline (CORE).
    const rows = await sb.from('los_members').select('abo_number, last_updated_by_abo').in('abo_number', [NEW, CHILD, CORE])
    const byAbo = Object.fromEntries((rows.data ?? []).map(r => [r.abo_number, r.last_updated_by_abo]))
    expect(byAbo[NEW]).toBe(CORE)   // new member, owned by CORE
    expect(byAbo[CHILD]).toBe(CORE) // CORE is CHILD's upline → "by upline"
    expect(byAbo[CORE]).toBe(CORE)  // CORE's own row → self

    const sub = await sb.from('los_submission_requests').select('status').eq('id', pending.id).single()
    expect(sub.data!.status).toBe('approved')
  })

  test('senior CORE import stamps a downline node with the senior owner (upline)', async ({ page }) => {
    await signInAs(page, SENIOR_EMAIL)
    await page.request.post('/api/profile/los-submission', {
      data: { rows: [row(SENIOR, ''), row(CORE, SENIOR), row(CHILD, CORE)] },
    })
    await signInAs(page, ADMIN_EMAIL)
    const adminList = await (await page.request.get('/api/admin/los-submission')).json()
    const pending = adminList.submissions.find((s: { status: string; root_abo_number: string }) => s.status === 'pending' && s.root_abo_number === SENIOR)
    await page.request.post('/api/admin/los-submission', { data: { action: 'approve', ids: [pending.id] } })

    const child = await sb.from('los_members').select('last_updated_by_abo').eq('abo_number', CHILD).single()
    expect(child.data!.last_updated_by_abo).toBe(SENIOR) // senior (upline) last touched CHILD
  })

  test('admin can reject a pending submission', async ({ page }) => {
    await signInAs(page, CORE_EMAIL)
    await page.request.post('/api/profile/los-submission', {
      data: { rows: [row(CORE, SENIOR), row(CHILD, CORE)] },
    })
    await signInAs(page, ADMIN_EMAIL)
    const adminList = await (await page.request.get('/api/admin/los-submission')).json()
    const pending = adminList.submissions.find((s: { status: string; root_abo_number: string }) => s.status === 'pending' && s.root_abo_number === CORE)
    const res = await page.request.post('/api/admin/los-submission', { data: { action: 'reject', id: pending.id, note: 'e2e reject' } })
    expect(res.status()).toBe(200)
    const sub = await sb.from('los_submission_requests').select('status, admin_note').eq('id', pending.id).single()
    expect(sub.data!.status).toBe('rejected')
    expect(sub.data!.admin_note).toBe('e2e reject')
  })
})
