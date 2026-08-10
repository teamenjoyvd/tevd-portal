import { test, expect, type Locator, type Page } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * D1/D3 one-tap attend + meeting-link gating (issue 2608-DEV-706, part of
 * epic #702): link absent -> Attend -> link appears -> cancel -> link absent,
 * against a real seeded event and a real Clerk-authenticated member.
 *
 * Runs under the 'authenticated' project (see playwright.config.ts) — same
 * reason as payments-guest.spec.ts: mobile-390/desktop run in preview-smoke.yml
 * against a live Vercel Preview with no Clerk secrets, so clerk.signIn() fails
 * there. Requires local Supabase + a seeded Clerk test-instance member (see
 * scripts/seed-clerk-test-users.js). Never target a preview/prod-DB deployment.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'
const TEST_RUN_ID = randomUUID().slice(0, 8)
const EVENT_TITLE = `E2E Member Attend ${TEST_RUN_ID}`
const MEETING_URL = `https://meet.example.com/e2e-${TEST_RUN_ID}`

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

  // Member attend is 403 for role 'guest' — the seeded test member must
  // already be promoted, same precondition payments-guest.spec.ts relies on.
  if (!profile || profile.role === 'guest') return
  memberProfileId = profile.id

  const now = Date.now()
  const { data: event, error: insertError } = await sb
    .from('calendar_events')
    .insert({
      title: EVENT_TITLE,
      start_time: new Date(now + 3600_000).toISOString(),
      end_time: new Date(now + 7200_000).toISOString(),
      week_number: 1,
      allow_guest_registration: true,
      meeting_url: MEETING_URL,
    })
    .select('id')
    .single()

  // Skipping is reserved for missing credentials or an intentionally-absent
  // seeded member (skipIfUnseeded, below) — a DB/schema/permission failure
  // here must fail loudly, not silently masquerade as "unseeded".
  if (insertError || !event) {
    throw new Error(`Failed to seed event for member-attend-auth: ${insertError?.message ?? 'no row returned'}`)
  }
  eventId = event.id
})

test.afterAll(async () => {
  if (!sb) return
  if (memberProfileId && eventId) {
    await sb.from('guest_registrations').delete().eq('event_id', eventId).eq('profile_id', memberProfileId)
  }
  if (eventId) await sb.from('calendar_events').delete().eq('id', eventId)
})

function skipIfUnseeded() {
  test.skip(
    sb === null || eventId === null || memberProfileId === null,
    'no SUPABASE_SERVICE_ROLE_KEY, or no member profile for E2E_CLERK_MEMBER_EMAIL — run: npm run e2e:seed-clerk',
  )
}

// CalendarClient renders both the mobile and desktop DOM trees at once (one
// hidden via CSS per breakpoint, not unmounted) — see e2e/calendar.spec.ts.
// Every grid-event query must be scoped to the visible tree, or `.first()`
// can lock onto the CSS-hidden twin and time out waiting for it to show.
function visible(page: Page, locator: Locator): Locator {
  return locator.and(page.locator(':visible'))
}

/**
 * Put the member in the "attending" state without going through the UI.
 * Deletes first: `guest_registrations_event_profile_uniq` (event_id, profile_id)
 * makes a bare insert fail once an earlier test in this file has registered
 * this member — a soft cancel leaves the row in place.
 */
async function seedMemberRegistration() {
  await sb!.from('guest_registrations').delete().eq('event_id', eventId!).eq('profile_id', memberProfileId!)
  const { error } = await sb!
    .from('guest_registrations')
    .insert({
      event_id: eventId!,
      profile_id: memberProfileId!,
      name: 'E2E Member',
      status: 'confirmed',
    })
  if (error) throw new Error(`Failed to seed member registration: ${error.message}`)
}

async function openEventPopup(page: Page) {
  await page.goto('/calendar')
  const eventButton = visible(page, page.locator('[role="row"] button', { hasText: EVENT_TITLE })).first()
  await expect(eventButton, `seeded event "${EVENT_TITLE}" not visible on the current month view`).toBeVisible({ timeout: 15_000 })
  await eventButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('member one-tap attend @auth', () => {
  test('link absent -> Attend -> link appears -> cancel -> link absent', async ({ page }) => {
    skipIfUnseeded()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })

    await openEventPopup(page)

    // Not yet registered: the meeting link is gated (D3), the hint explains why.
    await expect(page.getByText(/attend to see the meeting link/i)).toBeVisible()
    await expect(page.locator(`a[href="${MEETING_URL}"]`)).toHaveCount(0)

    await page.getByRole('button', { name: /^attend$/i }).click()

    // D1: one-tap, no confirmation step — the link appears directly.
    await expect(page.locator(`a[href="${MEETING_URL}"]`)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/^attending$/i)).toBeVisible()

    const { data: afterAttend } = await sb!
      .from('guest_registrations')
      .select('status, cancelled_at')
      .eq('event_id', eventId!)
      .eq('profile_id', memberProfileId!)
      .single()
    expect(afterAttend?.status).toBe('confirmed')
    expect(afterAttend?.cancelled_at).toBeNull()

    await page.getByRole('button', { name: /can't attend/i }).click()
    await expect(page.getByText(/cancel your attendance\?/i)).toBeVisible()
    await page.getByRole('button', { name: /can't attend/i }).last().click()

    // Cancelled: the link is gated again.
    await expect(page.getByText(/attend to see the meeting link/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`a[href="${MEETING_URL}"]`)).toHaveCount(0)

    const { data: afterCancel } = await sb!
      .from('guest_registrations')
      .select('status, cancelled_at')
      .eq('event_id', eventId!)
      .eq('profile_id', memberProfileId!)
      .single()
    expect(afterCancel?.cancelled_at).not.toBeNull()
  })
})

// -- D4: token-free member join + attendance stamp (2608-DEV-707) --------------

test.describe('member token-free join @auth', () => {
  test('/events/[id]/join with no token stamps attended_at exactly once', async ({ page }) => {
    skipIfUnseeded()

    // Seeded directly rather than through the popup: this test is about the
    // join route, and the attend loop itself is already covered above.
    await seedMemberRegistration()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })

    // No ?token= — the member is resolved through Clerk instead.
    await page.goto(`/events/${eventId}/join`)
    await expect(page.getByRole('heading', { name: EVENT_TITLE })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`a[href="${MEETING_URL}"]`).first()).toBeVisible()

    const { data: firstVisit } = await sb!
      .from('guest_registrations')
      .select('attended_at, status')
      .eq('event_id', eventId!)
      .eq('profile_id', memberProfileId!)
      .single()
    expect(firstVisit?.attended_at).not.toBeNull()
    expect(firstVisit?.status).toBe('confirmed')

    // Idempotent: a reload (or a mail-client prefetch) must not re-stamp.
    await page.reload()
    await expect(page.getByRole('heading', { name: EVENT_TITLE })).toBeVisible()

    const { data: secondVisit } = await sb!
      .from('guest_registrations')
      .select('attended_at')
      .eq('event_id', eventId!)
      .eq('profile_id', memberProfileId!)
      .single()
    expect(secondVisit?.attended_at).toBe(firstVisit?.attended_at)
  })

  test('anonymous visitor with no token still gets the invalid-link screen', async ({ page }) => {
    skipIfUnseeded()

    await page.goto(`/events/${eventId}/join`)
    await expect(page.getByText(/this link is invalid/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

// -- D4: the popup's attending-state CTA row at 390px ---------------------------

test.describe('attending CTA row at 390px @auth', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Join meeting + Add to calendar render inside the popup', async ({ page }) => {
    skipIfUnseeded()

    await seedMemberRegistration()

    await page.goto('/')
    await clerk.signIn({ page, emailAddress: MEMBER_EMAIL })
    await openEventPopup(page)

    const joinCta = page.getByRole('link', { name: /join meeting/i })
    await expect(joinCta).toBeVisible({ timeout: 15_000 })
    await expect(joinCta).toHaveAttribute('href', `/events/${eventId}/join`)
    await expect(page.getByText(/records your attendance/i)).toBeVisible()

    // The dropdown is portaled to the body — assert it actually opens above the
    // dialog rather than merely existing in the DOM.
    await page.getByRole('button', { name: /add to calendar/i }).click()
    await expect(page.getByRole('menuitem', { name: /google calendar/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /outlook/i })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /\.ics/i })).toBeVisible()
  })
})
