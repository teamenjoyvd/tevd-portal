import { test, expect, type Locator, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * D5 tiered Registrations tab (issue 2608-DEV-709, part of epic #702).
 *
 * One seeded event carries five registrations spanning every tier, and the
 * same tab is opened by three different Clerk identities. What each sees is
 * decided entirely by get_event_registrations_for_viewer — the client never
 * filters — so these cases are the only place the tiering is exercised
 * end-to-end.
 *
 * Runs under the 'authenticated' project (playwright.config.ts): every case
 * needs a real Clerk session AND role-dependent DB rows, and mobile-390/
 * desktop run in preview-smoke.yml against a live Vercel Preview with no
 * Clerk secrets, where clerk.signIn() fails outright.
 *
 * Fixtures come from scripts/seed-clerk-test-users.js (`npm run e2e:seed-clerk`),
 * which plants the CORE at its own root with its own downline — disjoint from
 * the MEMBER's leg, which is what makes the "unrelated branch is not listed"
 * assertion meaningful.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'
const ADMIN_EMAIL = process.env.E2E_CLERK_ADMIN_EMAIL ?? 'e2e-admin-tevd-portal@example.com'
const CORE_EMAIL = process.env.E2E_CLERK_CORE_EMAIL ?? 'e2e-core-tevd-portal@example.com'

const CORE_DOWNLINE_CLERK_ID = 'seed_e2e_core_downline_tevd_portal'
const MEMBER_DOWNLINE_CLERK_ID = 'seed_e2e_downline_tevd_portal'

const TEST_RUN_ID = randomUUID().slice(0, 8)
const EVENT_TITLE = `E2E Registrations ${TEST_RUN_ID}`

// Every name is run-scoped: the DEV project is shared, and a bare "E2E Guest"
// could match a row left by another spec and turn a visibility assertion into
// a false pass.
const CORE_DOWNLINE_GUEST = `Core Downline Guest ${TEST_RUN_ID}`
const MEMBER_OWN_GUEST = `Member Own Guest ${TEST_RUN_ID}`
const UNATTRIBUTED_GUEST = `Unattributed Guest ${TEST_RUN_ID}`

function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url === undefined || url === '' || key === undefined || key === '') return null
  return createClient(url, key)
}

let sb: SupabaseClient | null = null
let eventId: string | null = null
let coreDownlineName: string | null = null
let memberDownlineName: string | null = null
let memberName: string | null = null

async function profileByEmail(email: string) {
  const { data } = await sb!
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('contact_email', email)
    .maybeSingle()
  return data
}

async function profileByClerkId(clerkId: string) {
  const { data } = await sb!
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  return data
}

function fullName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(' ')
}

/** A share link owned by `profileId`, so guests registered through it attribute to them. */
async function seedShareLink(profileId: string): Promise<string> {
  const { data, error } = await sb!
    .from('event_share_links')
    .insert({
      event_id: eventId!,
      profile_id: profileId,
      token: `e2e-${TEST_RUN_ID}-${randomUUID().slice(0, 8)}`,
      share_method: 'clipboard',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to seed share link: ${error?.message ?? 'no row'}`)
  return data.id
}

/** A member sign-up. email/token/expires_at stay NULL — the guest_xor_member CHECK requires it. */
async function seedMemberRegistration(profileId: string, name: string) {
  const { error } = await sb!
    .from('guest_registrations')
    .insert({ event_id: eventId!, profile_id: profileId, name, status: 'confirmed' })
  if (error) throw new Error(`Failed to seed member registration for ${name}: ${error.message}`)
}

/** An external guest. shareLinkId null == the unattributed, admin-only case. */
async function seedGuestRegistration(name: string, shareLinkId: string | null) {
  const { error } = await sb!.from('guest_registrations').insert({
    event_id: eventId!,
    name,
    email: `${name.replace(/\s+/g, '-').toLowerCase()}@example.com`,
    token: `e2e-guest-${randomUUID()}`,
    expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    share_link_id: shareLinkId,
    status: 'pending',
  })
  if (error) throw new Error(`Failed to seed guest registration for ${name}: ${error.message}`)
}

test.beforeAll(async () => {
  sb = svc()
  if (!sb) return

  const core = await profileByEmail(CORE_EMAIL)
  const member = await profileByEmail(MEMBER_EMAIL)
  const admin = await profileByEmail(ADMIN_EMAIL)
  const coreDownline = await profileByClerkId(CORE_DOWNLINE_CLERK_ID)
  const memberDownline = await profileByClerkId(MEMBER_DOWNLINE_CLERK_ID)

  // An unseeded environment skips (skipIfUnseeded). A core fixture whose role
  // was never promoted is the same class of problem — the roster would be
  // empty for a reason that has nothing to do with the code under test.
  if (!core || core.role !== 'core' || !member || !admin || !coreDownline || !memberDownline) return

  coreDownlineName = fullName(coreDownline)
  memberDownlineName = fullName(memberDownline)
  memberName = fullName(member)

  const now = Date.now()
  const { data: event, error: insertError } = await sb
    .from('calendar_events')
    .insert({
      title: EVENT_TITLE,
      start_time: new Date(now + 3600_000).toISOString(),
      end_time: new Date(now + 7200_000).toISOString(),
      week_number: 1,
      allow_guest_registration: true,
    })
    .select('id')
    .single()

  // Skipping is reserved for missing credentials or absent fixtures — a
  // DB/schema/permission failure must fail loudly, not masquerade as unseeded.
  if (insertError || !event) {
    throw new Error(`Failed to seed event for event-registrations-auth: ${insertError?.message ?? 'no row returned'}`)
  }
  eventId = event.id

  // The five rows the three viewers slice differently.
  await seedMemberRegistration(coreDownline.id, coreDownlineName)          // core: yes  member: no
  await seedGuestRegistration(CORE_DOWNLINE_GUEST, await seedShareLink(coreDownline.id))
  await seedMemberRegistration(member.id, memberName)                      // member: own sign-up
  await seedGuestRegistration(MEMBER_OWN_GUEST, await seedShareLink(member.id))
  await seedMemberRegistration(memberDownline.id, memberDownlineName)      // the unrelated branch
  await seedGuestRegistration(UNATTRIBUTED_GUEST, null)                    // admin only
})

test.afterAll(async () => {
  if (!sb || !eventId) return
  // guest_registrations.share_link_id would block the share-link delete, so
  // registrations go first.
  await sb.from('guest_registrations').delete().eq('event_id', eventId)
  await sb.from('event_share_links').delete().eq('event_id', eventId)
  await sb.from('calendar_events').delete().eq('id', eventId)
})

function skipIfUnseeded() {
  test.skip(
    sb === null || eventId === null || coreDownlineName === null,
    'no SUPABASE_SERVICE_ROLE_KEY, or the member/admin/core fixtures are missing — run: npm run e2e:seed-clerk',
  )
}

// CalendarClient renders the mobile and desktop DOM trees at once (one hidden
// via CSS per breakpoint, not unmounted), so an unscoped .first() can lock onto
// the CSS-hidden twin — see e2e/member-attend-auth.spec.ts:87-93.
function visible(page: Page, locator: Locator): Locator {
  return locator.and(page.locator(':visible'))
}

/**
 * A registrant's name is NOT unique text in this tab: whoever invited a guest
 * is rendered again inside that guest's row as `via <name>`. So presence is
 * asserted against the name node of a row, and absence against whole rows —
 * never against bare page text, which matches both and trips strict mode.
 */
function nameCell(dialog: Locator, name: string): Locator {
  return dialog.getByTestId('registration-name').filter({ hasText: name })
}

/** Any row MENTIONING `text` — the right locator for "this person is not listed at all". */
function row(dialog: Locator, text: string): Locator {
  return dialog.getByTestId('registration-row').filter({ hasText: text })
}

/**
 * The row whose REGISTRANT is `name`, not merely a row that mentions them: an
 * inviter is named again in the `via <sharer>` line of every guest row they
 * own, so `filter({ hasText })` alone matches two rows for the same person.
 */
function rowOf(dialog: Locator, name: string): Locator {
  return dialog.locator(`[data-testid="registration-row"]:has([data-testid="registration-name"]:text-is("${name}"))`)
}

async function openRegistrationsTab(page: Page) {
  await page.goto('/calendar')
  const eventButton = visible(page, page.locator('[role="row"] button', { hasText: EVENT_TITLE })).first()
  await expect(eventButton, `seeded event "${EVENT_TITLE}" not visible on the current month view`).toBeVisible({ timeout: 15_000 })
  await eventButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // role="tab", not "button": EventActionsTabs sets an explicit role="tab" on
  // these, which overrides <button>'s implicit one, so getByRole('button')
  // matches nothing. This locator doubles as the assertion that the tab
  // semantics are present.
  await dialog.getByRole('tab', { name: /registrations/i }).click()
  return dialog
}

test.describe('tiered registrations tab @auth', () => {
  test('CORE sees its own subtree and neither the unrelated branch nor unattributed guests', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: CORE_EMAIL })

    const dialog = await openRegistrationsTab(page)

    // In scope: the downline's own sign-up, and the guest that downline invited.
    await expect(nameCell(dialog, coreDownlineName!)).toBeVisible({ timeout: 15_000 })
    await expect(nameCell(dialog, CORE_DOWNLINE_GUEST)).toBeVisible()

    // Out of scope: a different leg entirely, and a guest nobody in this
    // subtree invited.
    await expect(row(dialog, memberDownlineName!)).toHaveCount(0)
    await expect(row(dialog, UNATTRIBUTED_GUEST)).toHaveCount(0)
  })

  test('MEMBER sees only its own sign-up and its own share-link guests', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })

    const dialog = await openRegistrationsTab(page)

    await expect(nameCell(dialog, memberName!)).toBeVisible({ timeout: 15_000 })
    await expect(nameCell(dialog, MEMBER_OWN_GUEST)).toBeVisible()

    // A member's scope is {self} — its own downline's sign-up is NOT its
    // business, and neither is anything on the core's leg.
    await expect(row(dialog, memberDownlineName!)).toHaveCount(0)
    await expect(row(dialog, CORE_DOWNLINE_GUEST)).toHaveCount(0)
    await expect(row(dialog, UNATTRIBUTED_GUEST)).toHaveCount(0)
  })

  test('ADMIN sees every registration including the unattributed guest', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: ADMIN_EMAIL })

    const dialog = await openRegistrationsTab(page)

    await expect(nameCell(dialog, UNATTRIBUTED_GUEST)).toBeVisible({ timeout: 15_000 })
    await expect(nameCell(dialog, CORE_DOWNLINE_GUEST)).toBeVisible()
    await expect(nameCell(dialog, MEMBER_OWN_GUEST)).toBeVisible()
    await expect(nameCell(dialog, coreDownlineName!)).toBeVisible()
    await expect(nameCell(dialog, memberDownlineName!)).toBeVisible()
  })
})

test.describe('registrations tab at 390px @auth', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('member rows carry a Member badge and no email, with no horizontal overflow', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: ADMIN_EMAIL })

    const dialog = await openRegistrationsTab(page)

    const memberRow = rowOf(dialog, coreDownlineName!)
    await expect(memberRow).toBeVisible({ timeout: 15_000 })

    // The member badge is there; the email is not. Member rows are email-less
    // at the DB level (guest_xor_member CHECK), so an address rendered here
    // would mean the roster invented one.
    await expect(memberRow.getByText(/^member$/i)).toBeVisible()
    await expect(memberRow.getByText(/@example\.com/)).toHaveCount(0)

    // A guest row still shows one — otherwise the assertion above would pass
    // for the trivial reason that no email renders anywhere.
    await expect(rowOf(dialog, CORE_DOWNLINE_GUEST).getByText(/@example\.com/)).toBeVisible()

    // html { overflow-x: hidden } clips visually without shrinking scrollWidth,
    // so this still detects a real 390px overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
