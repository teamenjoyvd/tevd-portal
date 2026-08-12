import { test, expect, type Locator, type Page } from '@playwright/test'
import { signInAndWaitForSession } from './auth-helpers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * D1 second half (issue 2608-DEV-708, part of epic #702): a signed-in member
 * opening someone else's `?share=` link on /events/[id]/register gets the
 * one-tap panel with the inviter credited — never the guest name+email form.
 *
 * Runs under the 'authenticated' project (see playwright.config.ts), same
 * reason as member-attend-auth.spec.ts: mobile-390/desktop run in
 * preview-smoke.yml against a live Vercel Preview with no Clerk secrets, so
 * clerk.signIn() dies on bot protection there. Requires local Supabase + a
 * seeded Clerk test-instance member (scripts/seed-clerk-test-users.js).
 * Never target a preview/prod-DB deployment.
 */

const MEMBER_EMAIL = process.env.E2E_CLERK_MEMBER_EMAIL ?? 'e2e-member-tevd-portal@example.com'
const TEST_RUN_ID = randomUUID().slice(0, 8)
const EVENT_TITLE = `E2E Member Share Register ${TEST_RUN_ID}`
const INVITER_TOKEN = `e2e-inviter-${TEST_RUN_ID}`
const OWN_TOKEN = `e2e-own-${TEST_RUN_ID}`
const MEETING_URL = `https://meet.example.com/e2e-share-${TEST_RUN_ID}`

function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url === undefined || url === '' || key === undefined || key === '') return null
  return createClient(url, key)
}

let sb: SupabaseClient | null = null
let eventId: string | null = null
let memberProfileId: string | null = null
let inviterProfileId: string | null = null
let inviterLinkId: string | null = null
let ownLinkId: string | null = null
let inviterName: string | null = null

test.beforeAll(async () => {
  sb = svc()
  if (!sb) return

  const { data: profile } = await sb
    .from('profiles')
    .select('id, role')
    .eq('contact_email', MEMBER_EMAIL)
    .maybeSingle()

  // Member attend is 403 for role 'guest' — the seeded test member must
  // already be promoted, the same precondition member-attend-auth relies on.
  if (!profile || profile.role === 'guest') return
  memberProfileId = profile.id

  // The inviter is any OTHER profile with a name to render: the panel credits
  // `first_name + ' ' + last_name`, so a nameless row would make the
  // "Invited by" assertion vacuous.
  const { data: inviter } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .neq('id', memberProfileId)
    .not('first_name', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!inviter) return
  inviterProfileId = inviter.id
  inviterName = `${inviter.first_name ?? ''} ${inviter.last_name ?? ''}`.trim()

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

  // Skipping is reserved for missing credentials or an unseeded member
  // (skipIfUnseeded, below) — a DB/schema/permission failure must fail loudly.
  if (insertError || !event) {
    throw new Error(`Failed to seed event for member-share-register-auth: ${insertError?.message ?? 'no row returned'}`)
  }
  eventId = event.id

  const { data: links, error: linkError } = await sb
    .from('event_share_links')
    .insert([
      { profile_id: inviterProfileId, event_id: eventId, token: INVITER_TOKEN, share_method: 'clipboard' },
      { profile_id: memberProfileId,  event_id: eventId, token: OWN_TOKEN,     share_method: 'clipboard' },
    ])
    .select('id, profile_id')

  if (linkError || !links) {
    throw new Error(`Failed to seed share links: ${linkError?.message ?? 'no rows returned'}`)
  }
  inviterLinkId = links.find((l) => l.profile_id === inviterProfileId)?.id ?? null
  ownLinkId     = links.find((l) => l.profile_id === memberProfileId)?.id ?? null
})

test.afterAll(async () => {
  if (!sb) return
  if (eventId) {
    // event_share_links and guest_registrations both cascade from the event,
    // but the registration is deleted explicitly so a failure to remove the
    // event never leaves this member registered on a stray row.
    if (memberProfileId) {
      await sb.from('guest_registrations').delete().eq('event_id', eventId).eq('profile_id', memberProfileId)
    }
    await sb.from('event_share_links').delete().eq('event_id', eventId)
    await sb.from('calendar_events').delete().eq('id', eventId)
  }
})

function skipIfUnseeded() {
  test.skip(
    sb === null || eventId === null || memberProfileId === null || inviterLinkId === null,
    'no SUPABASE_SERVICE_ROLE_KEY, no member profile for E2E_CLERK_MEMBER_EMAIL, or no second named profile to act as inviter — run: npm run e2e:seed-clerk',
  )
}

/**
 * Hard-delete this member's row for the event. A soft cancel leaves the row in
 * place, and `guest_registrations_event_profile_uniq` (event_id, profile_id)
 * would then make the next test's attend an adopt-in-place of the previous
 * one's share_link_id instead of a fresh attribution.
 */
async function clearRegistration() {
  await sb!.from('guest_registrations').delete().eq('event_id', eventId!).eq('profile_id', memberProfileId!)
}

async function registrationRow() {
  const { data } = await sb!
    .from('guest_registrations')
    .select('share_link_id, profile_id, status, cancelled_at')
    .eq('event_id', eventId!)
    .eq('profile_id', memberProfileId!)
    .single()
  return data
}

/**
 * `/events/:id/register` is PUBLIC (`/events/(.*)` in PUBLIC_ROUTE_PATTERNS),
 * so gotoProtected cannot help: proxy.ts never redirects it, and without a
 * server-side session the page still renders — as the anonymous guest form
 * (name/email inputs) instead of MemberAttendPanel. expectMemberPanel would
 * then fail on "signed in as", naming the panel rather than the missing
 * session. So the wait goes on the session itself, before the navigation
 * (2608-DEV-734, e2e/auth-helpers.ts).
 */
async function signInAsMember(page: Page) {
  await signInAndWaitForSession(page, MEMBER_EMAIL)
}

// The page renders BOTH layout blocks at once (one hidden per breakpoint via
// CSS, not unmounted — page.tsx desktop/mobile), so every panel query matches
// twice. Scope to the visible tree or strict mode fails the locator outright.
function visible(page: Page, locator: Locator): Locator {
  return locator.and(page.locator(':visible'))
}

function attendButton(page: Page): Locator {
  return visible(page, page.getByRole('button', { name: /attend this event/i }))
}

function attendingBadge(page: Page): Locator {
  return visible(page, page.getByText(/you're attending this event/i))
}

/** The panel and the guest form are mutually exclusive — assert both halves. */
async function expectMemberPanel(page: Page) {
  // visible(), not .first(): .first() is DOM order, and the desktop block is
  // rendered before the mobile one, so at 390px .first() locks onto the
  // CSS-hidden desktop copy and waits out the timeout.
  await expect(visible(page, page.getByText(/signed in as/i))).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('input#name')).toHaveCount(0)
  await expect(page.locator('input#email')).toHaveCount(0)
}

test.describe('recognised member on the share/register page @auth', () => {
  test("member on an inviter's link attends one-tap and credits the inviter", async ({ page }) => {
    skipIfUnseeded()
    await clearRegistration()

    await signInAsMember(page)
    await page.goto(`/events/${eventId}/register?share=${INVITER_TOKEN}`)

    await expectMemberPanel(page)
    // String, not a RegExp: inviterName comes from an arbitrary profiles row, and
    // a metacharacter in it would change the pattern (or throw). getByText's
    // default `exact: false` is already a case-insensitive substring match.
    await expect(visible(page, page.getByText(`Invited by ${inviterName}`, { exact: false }))).toBeVisible()

    // D3: the meeting link is not in the payload of someone with no active row.
    // toHaveCount(0) over the WHOLE page, not the visible subtree — a link
    // hidden in the other breakpoint's block would still be a leak.
    await expect(page.locator(`a[href="${MEETING_URL}"]`)).toHaveCount(0)

    await attendButton(page).click()

    // The attending state renders from the server after router.refresh().
    await expect(attendingBadge(page)).toBeVisible({ timeout: 15_000 })

    // ...and only then does the server put meeting_url in the payload.
    await expect(visible(page, page.locator(`a[href="${MEETING_URL}"]`))).toBeVisible()
    await expect(visible(page, page.getByRole('button', { name: /add to calendar/i }))).toBeVisible()

    const row = await registrationRow()
    expect(row?.share_link_id).toBe(inviterLinkId)
    expect(row?.profile_id).toBe(memberProfileId)
    expect(row?.cancelled_at).toBeNull()
  })

  test('member on their OWN link attends with share_link_id left null', async ({ page }) => {
    skipIfUnseeded()
    await clearRegistration()

    await signInAsMember(page)
    await page.goto(`/events/${eventId}/register?share=${OWN_TOKEN}`)

    await expectMemberPanel(page)
    await attendButton(page).click()
    await expect(attendingBadge(page)).toBeVisible({ timeout: 15_000 })

    // Self-attribution guard: lib/server/member-registration.ts:181.
    const row = await registrationRow()
    expect(row?.share_link_id).toBeNull()
    expect(ownLinkId).not.toBeNull()
  })

  test('a full event does not block a member who already has an active row', async ({ page }) => {
    skipIfUnseeded()
    await clearRegistration()

    await signInAsMember(page)
    await page.goto(`/events/${eventId}/register?share=${INVITER_TOKEN}`)
    await attendButton(page).click()
    await expect(attendingBadge(page)).toBeVisible({ timeout: 15_000 })

    try {
      // Capacity 1 with exactly this member's row active -> the page's
      // eventFull count is met. They are re-opening their own link, not
      // consuming a new seat, so the capacity block must not appear.
      const { error } = await sb!.from('calendar_events').update({ guest_capacity: 1 }).eq('id', eventId!)
      if (error) throw new Error(`Failed to cap the event: ${error.message}`)

      await page.reload()
      await expect(attendingBadge(page)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/reached its guest capacity/i)).toHaveCount(0)
    } finally {
      // Restored even on failure — the other tests in this file share the event
      // and would otherwise inherit a capacity that blocks them.
      await sb!.from('calendar_events').update({ guest_capacity: null }).eq('id', eventId!)
    }
  })

  test('logged-out visitor on the same URL still gets the guest form', async ({ page }) => {
    skipIfUnseeded()

    await page.goto(`/events/${eventId}/register?share=${INVITER_TOKEN}`)

    await expect(page.locator('input#name').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input#email').first()).toBeVisible()
    await expect(page.getByText(/signed in as/i)).toHaveCount(0)
  })
})

// -- 390px: the mobile block of the page renders the same panel ----------------

test.describe('member share/register panel at 390px @auth', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('one-tap panel renders in the mobile layout', async ({ page }) => {
    skipIfUnseeded()
    await clearRegistration()

    await signInAsMember(page)
    await page.goto(`/events/${eventId}/register?share=${INVITER_TOKEN}`)

    await expectMemberPanel(page)

    const button = attendButton(page)
    await expect(button).toBeVisible()

    const box = await button.boundingBox()
    expect(box, 'attend button has no layout box at 390px').not.toBeNull()
    // 390px hard constraint: the CTA must fit the viewport and stay tappable.
    expect(box!.width).toBeLessThanOrEqual(390)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
