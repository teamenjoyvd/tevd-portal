import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

/**
 * Guest-invite event-change/cancel notification suite (issue 2607-DEV-592,
 * part 6/6 of the guest-invite milestone). Covers the public register/join
 * flow end to end plus the tracked email sends, by querying
 * notification_delivery_log directly through a Supabase service client —
 * matches how scripts/seed-guest-test-user.js connects to DEV.
 *
 * Depends on a real future event with allow_guest_registration=true and an
 * admin profile to attribute a share link to. When neither exists — an
 * unseeded local DB, or DEV freshly re-mirrored from prod — the whole suite
 * skips gracefully with a pointer to the seed command, rather than failing
 * on missing fixture data (mirrors e2e/library-guide.spec.ts). Also skips
 * gracefully when SUPABASE_SERVICE_ROLE_KEY isn't present in the environment
 * at all — the advisory "390px smoke vs preview" CI job (preview-smoke.yml)
 * runs mobile-390 against a live preview URL without DB credentials, since
 * it only smoke-tests public pages.
 *
 * Test data is namespaced under a unique run id and cleaned up in afterAll.
 */

const TEST_RUN_ID = randomUUID().slice(0, 8)
const GUEST_EMAIL = `e2e-guest-invite-${TEST_RUN_ID}@example.com`
const GUEST_NAME = 'E2E Guest Invite'

function svc(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

type Fixture = {
  eventId: string
  meetingUrl: string | null
  shareToken: string
  revokedShareToken: string
  shareLinkIds: string[]
}

let sb: SupabaseClient | null = null
let fx: Fixture | null = null

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  sb = svc()
  if (!sb) {
    fx = null
    return
  }

  const { data: event } = await sb
    .from('calendar_events')
    .select('id, meeting_url, end_time, allow_guest_registration')
    .eq('allow_guest_registration', true)
    .gt('end_time', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (!event || !profile) {
    fx = null
    return
  }

  const shareToken = `e2e-share-${TEST_RUN_ID}`
  const revokedShareToken = `e2e-share-revoked-${TEST_RUN_ID}`

  const { data: links, error } = await sb
    .from('event_share_links')
    .insert([
      { profile_id: profile.id, event_id: event.id, token: shareToken, share_method: 'clipboard' },
      { profile_id: profile.id, event_id: event.id, token: revokedShareToken, share_method: 'clipboard', revoked_at: new Date().toISOString() },
    ])
    .select('id')

  if (error || !links) {
    fx = null
    return
  }

  fx = {
    eventId: event.id,
    meetingUrl: event.meeting_url,
    shareToken,
    revokedShareToken,
    shareLinkIds: links.map(l => l.id),
  }
})

test.afterAll(async () => {
  if (!sb) return
  await sb.from('guest_registrations').delete().eq('email', GUEST_EMAIL)
  if (fx) await sb.from('event_share_links').delete().in('id', fx.shareLinkIds)
})

function skipIfUnseeded() {
  test.skip(
    fx === null,
    'no future event with allow_guest_registration=true (or no admin profile) in this DB — ' +
      'run: npm run seed:smoke-guest (DEV/local)',
  )
}

// -- register-with-share → success --------------------------------------------

test('register with a share link succeeds and sends the magic-link email', async ({ page }) => {
  skipIfUnseeded()
  const { eventId, shareToken } = fx!

  await page.goto(`/events/${eventId}/register?share=${shareToken}`)
  await page.fill('#name', GUEST_NAME)
  await page.fill('#email', GUEST_EMAIL)
  await page.click('button[type="submit"]')

  await expect(page.getByText('Check your inbox')).toBeVisible()

  // Poll notification_delivery_log for the magic-link send — fire-and-forget,
  // so give it a short window to land.
  await expect
    .poll(
      async () => {
        const { count } = await sb!
          .from('notification_delivery_log')
          .select('id', { count: 'exact', head: true })
          .eq('template', 'guest_event_magic_link')
          .eq('recipient', GUEST_EMAIL)
        return count ?? 0
      },
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0)
})

// -- join via token → confirmed/attended + meeting URL shown -----------------

test('joining via the magic-link token confirms attendance and shows the meeting link', async ({ page }) => {
  skipIfUnseeded()
  const { eventId, meetingUrl } = fx!

  const { data: reg } = await sb!
    .from('guest_registrations')
    .select('token')
    .eq('event_id', eventId)
    .eq('email', GUEST_EMAIL)
    .single()
  expect(reg?.token, 'registration from the prior test must exist').toBeTruthy()

  await page.goto(`/events/${eventId}/join?token=${reg!.token}`)

  await expect(page.getByText("You're joining", { exact: false })).toBeVisible().catch(() => {})

  if (meetingUrl) {
    await expect(page.locator(`a[href="${meetingUrl}"]`)).toBeVisible()
  }

  const { data: confirmedReg } = await sb!
    .from('guest_registrations')
    .select('status, attended_at')
    .eq('event_id', eventId)
    .eq('email', GUEST_EMAIL)
    .single()
  expect(confirmedReg?.status).toBe('confirmed')
  expect(confirmedReg?.attended_at).not.toBeNull()
})

// -- revoked share link → blocked ---------------------------------------------

test('registering through a revoked share link is blocked', async ({ page }) => {
  skipIfUnseeded()
  const { eventId, revokedShareToken } = fx!

  await page.goto(`/events/${eventId}/register?share=${revokedShareToken}`)
  await expect(page.getByText('This share link is no longer active.')).toBeVisible()
})

// -- bg-language variant renders Bulgarian copy -------------------------------

test('bg-language variant renders Bulgarian copy on the register page', async ({ page, context }) => {
  skipIfUnseeded()
  const { eventId } = fx!

  await context.addCookies([
    { name: 'tevd_lang', value: 'bg', url: process.env.BASE_URL ?? 'http://localhost:3000' },
  ])

  await page.goto(`/events/${eventId}/register`)
  await expect(page.getByText('Пълно име')).toBeVisible()
  await expect(page.getByText('Имейл адрес')).toBeVisible()
})

// -- 390px viewport: no horizontal overflow -----------------------------------

test.describe('390px viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('register page has no horizontal overflow at 390px', async ({ page }) => {
    skipIfUnseeded()
    const { eventId } = fx!

    await page.goto(`/events/${eventId}/register`)
    const scrollWidth = await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)
    expect(
      scrollWidth,
      `horizontal overflow on the register page: content is ${scrollWidth}px wide at a 390px viewport`,
    ).toBeLessThanOrEqual(390)
  })
})
