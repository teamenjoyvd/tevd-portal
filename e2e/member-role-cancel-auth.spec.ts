import { test, expect, type Locator, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { gotoProtected } from './auth-helpers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * 2608-DEV-749 — a member can give up a role they already hold, and the slot
 * reopens. Before this ticket the withdraw path did not exist: the DELETE route
 * filtered `status = 'pending'` and still answered 200, so an approved holder
 * saw a success toast and stayed in the slot forever.
 *
 * The approval step goes through the real `approve_event_role_request` RPC via
 * the service client rather than the admin UI — this spec is about the WITHDRAW
 * path, and driving the approval hub would double its runtime and its flake
 * surface for no extra coverage.
 *
 * Runs under the 'authenticated' project (playwright.config.ts) for the same
 * reason as member-attend-auth.spec.ts: preview-smoke has no Clerk secrets, so
 * clerk.signIn() cannot work there. Requires a seeded Clerk test member
 * (scripts/seed-clerk-test-users.js) and the DEV Supabase project — never a
 * preview/prod DB.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'
const TEST_RUN_ID = randomUUID().slice(0, 8)
const EVENT_TITLE = `E2E Role Cancel ${TEST_RUN_ID}`
const ROLE_LABEL = 'HOST'

function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url === undefined || url === '' || key === undefined || key === '') return null
  return createClient(url, key)
}

let sb: SupabaseClient | null = null
let eventId: string | null = null
let memberProfileId: string | null = null

test.beforeAll(async () => {
  sb = svc()
  if (!sb) return

  const { data: profile } = await sb
    .from('profiles')
    .select('id, role')
    .eq('contact_email', MEMBER_EMAIL)
    .maybeSingle()

  // Guests are 403 on this route — the seeded member must already be promoted.
  if (!profile || profile.role === 'guest') return
  memberProfileId = profile.id

  const now = Date.now()
  // +6h, comfortably outside the 60-minute cutoff (ROLE_CUTOFF_MS). At +30m the
  // role buttons would render locked and every assertion below would fail for
  // the wrong reason.
  const { data: event, error: insertError } = await sb
    .from('calendar_events')
    .insert({
      title: EVENT_TITLE,
      start_time: new Date(now + 6 * 3600_000).toISOString(),
      end_time: new Date(now + 7 * 3600_000).toISOString(),
      week_number: 1,
      allow_guest_registration: true,
      // The slot-sync trigger (20260512000600) materialises event_role_slots
      // from this array — inserting slots by hand would bypass the real path.
      available_roles: [ROLE_LABEL],
    })
    .select('id')
    .single()

  if (insertError || !event) {
    throw new Error(`Failed to seed event for member-role-cancel-auth: ${insertError?.message ?? 'no row returned'}`)
  }
  eventId = event.id
})

test.afterAll(async () => {
  if (!sb || !eventId) return
  // event_role_requests.event_id has no ON DELETE CASCADE (baseline.sql:158),
  // unlike event_role_slots — so the requests must go first or the event delete
  // fails on the FK. Approval also leaves a guest_registrations row behind
  // (2608-DEV-710); cancelling a role deliberately does not remove it.
  await sb.from('event_role_requests').delete().eq('event_id', eventId)
  await sb.from('guest_registrations').delete().eq('event_id', eventId)
  await sb.from('calendar_events').delete().eq('id', eventId)
})

function skipIfUnseeded() {
  test.skip(
    sb === null || eventId === null || memberProfileId === null,
    'no SUPABASE_SERVICE_ROLE_KEY, or no member profile for E2E_CLERK_MEMBER_EMAIL — run: npm run e2e:seed-clerk',
  )
}

// CalendarClient renders the mobile AND desktop trees at once (one hidden per
// breakpoint via CSS, not unmounted) — see e2e/calendar.spec.ts. Scope every
// grid query to the visible tree or `.first()` can lock onto the hidden twin.
function visible(page: Page, locator: Locator): Locator {
  return locator.and(page.locator(':visible'))
}

async function openEventPopup(page: Page) {
  await gotoProtected(page, '/calendar')
  const eventButton = visible(page, page.locator('[role="row"] button', { hasText: EVENT_TITLE })).first()
  await expect(eventButton, `seeded event "${EVENT_TITLE}" not visible on the current month view`)
    .toBeVisible({ timeout: 15_000 })
  await eventButton.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(EVENT_TITLE, { timeout: 15_000 })
  return dialog
}

async function readRequest() {
  const { data } = await sb!
    .from('event_role_requests')
    .select('id, status, cancelled_at, cancelled_by')
    .eq('event_id', eventId!)
    .eq('profile_id', memberProfileId!)
    .maybeSingle()
  return data
}

test.describe('member role withdraw @auth', () => {
  // 390px: every new UI surface must render there (CLAUDE.md hard constraint),
  // and the withdraw confirm is a new one.
  test.use({ viewport: { width: 390, height: 844 } })

  test('request -> admin approves -> member withdraws -> slot open again', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })

    let dialog = await openEventPopup(page)

    // The cutoff copy is new in 749 — the window used to be entirely silent.
    await expect(dialog.getByText(/sign-ups close 1 hour before start/i)).toBeVisible()

    // 1. Request the role.
    await dialog.getByRole('button', { name: ROLE_LABEL }).click()
    await expect(dialog.getByText(/your request/i)).toBeVisible({ timeout: 15_000 })

    const requested = await readRequest()
    expect(requested?.status).toBe('pending')

    // 2. Admin approves — through the real RPC the admin route calls.
    const { error: approveError } = await sb!.rpc('approve_event_role_request', {
      p_request_id: requested!.id,
    })
    expect(approveError).toBeNull()
    expect((await readRequest())?.status).toBe('approved')

    // 3. Reopen the popup so the client sees the approved state.
    await page.reload()
    dialog = await openEventPopup(page)

    // 4. Withdraw. An approved slot is destructive to give up, so it sits behind
    //    an AlertDialog — role="alertdialog", distinct from the popup's dialog.
    await dialog.getByRole('button', { name: ROLE_LABEL }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await expect(confirm.getByText(/the slot reopens for other members/i)).toBeVisible()
    await confirm.getByRole('button', { name: /give up role/i }).click()

    // 5. The request is gone from the member's view — /api/events/[id] stops
    //    sending a cancelled row as caller_request.
    await expect(dialog.getByText(/your request/i)).toHaveCount(0, { timeout: 15_000 })

    const cancelled = await readRequest()
    expect(cancelled?.status).toBe('cancelled')
    expect(cancelled?.cancelled_at).not.toBeNull()
    // Self-withdraw stamps the holder as the actor, which is also what
    // suppresses the "your role was cancelled" notification to themselves.
    expect(cancelled?.cancelled_by).toBe(memberProfileId)

    // 6. The slot is claimable again rather than stuck at 'filled'.
    const roleButton = dialog.getByRole('button', { name: ROLE_LABEL })
    await expect(roleButton).toBeEnabled()

    // 7. Decision 2: cancelling the ROLE does not cancel event attendance.
    const { data: registration } = await sb!
      .from('guest_registrations')
      .select('status, cancelled_at')
      .eq('event_id', eventId!)
      .eq('profile_id', memberProfileId!)
      .maybeSingle()
    expect(registration?.status).toBe('confirmed')
    expect(registration?.cancelled_at).toBeNull()

    // html { overflow-x: hidden } clips visually without shrinking scrollWidth,
    // so this still detects a real 390px overflow.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
