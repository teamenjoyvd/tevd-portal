import { beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for the share-link sharer notifiers (issue 2608-DEV-704).
// The bug this guards: the profiles embed selected a non-existent `email`
// column, PostgREST rejected the query, and all three helpers silently
// no-opped. Compile-time protection now comes from the uncast generated types
// (`npm run check-types`); these tests cover the runtime branches — who gets
// mailed, under which template, and every path that must send nothing.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()
const sentEmails: { to: string; template: string }[] = []
/** The raw PostgREST select string the resolver passed to supabase-js. */
let capturedSelect = ''

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
vi.mock('@/lib/email/send', () => ({
  sendTransactionalEmail: vi.fn((opts: { to: string; template: string }) => {
    sentEmails.push({ to: opts.to, template: opts.template })
    return Promise.resolve({ sent: true })
  }),
}))
vi.mock('@/lib/email/templates/render', () => ({
  renderEmailTemplate: () => Promise.resolve('<html></html>'),
}))
vi.mock('@/lib/email/templates/ShareGuestRegisteredEmail', () => ({
  ShareGuestRegisteredEmail: () => null,
}))
vi.mock('@/lib/email/templates/ShareGuestAttendedEmail', () => ({
  ShareGuestAttendedEmail: () => null,
}))
vi.mock('@/lib/email/templates/ShareGuestCancelledEmail', () => ({
  ShareGuestCancelledEmail: () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  sentEmails.length = 0
  capturedSelect = ''
})

type ShareLinkRow = {
  lang: string
  profile: { first_name: string; last_name: string; contact_email: string | null } | null
  event: { title: string } | null
}

const validRow: ShareLinkRow = {
  lang: 'en',
  profile: { first_name: 'Ivan', last_name: 'Petrov', contact_email: 'sharer@example.com' },
  event: { title: 'Trip Kickoff' },
}

function buildClient(result: { data: ShareLinkRow | null; error?: { message: string } | null }) {
  return {
    from: (table: string) => {
      if (table !== 'event_share_links') throw new Error(`unexpected table ${table}`)
      return {
        select: (query: string) => {
          capturedSelect = query
          return {
            eq: () => ({
              single: () => Promise.resolve({ data: result.data, error: result.error ?? null }),
            }),
          }
        },
      }
    },
  }
}

/** The helpers are fire-and-forget (void); let their promise chain drain. */
const flush = () => new Promise(r => setTimeout(r, 10))

// -- The column the whole issue turns on ----------------------------------------

describe('share link profile embed', () => {
  it('selects contact_email and never a bare email column', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(capturedSelect).toContain('contact_email')
    // `profiles` has no `email` column — selecting it 400s and the notifier
    // goes silent. \b does not match inside contact_email (underscore is \w).
    expect(capturedSelect).not.toMatch(/\bemail\b/)
  })
})

// -- Each helper mails the sharer under its own template ------------------------

const helpers = [
  ['notifySharerOfRegistration', 'share_guest_registered'],
  ['notifySharerOfAttendance', 'share_guest_attended'],
  ['notifySharerOfCancellation', 'share_guest_cancelled'],
] as const

describe.each(helpers)('%s', (helperName, template) => {
  it(`mails the sharer's contact_email with template ${template}`, async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    const mod = await import('@/lib/notifications/share-events')

    mod[helperName]('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toEqual([{ to: 'sharer@example.com', template }])
  })
})

// -- Every path that must stay silent -------------------------------------------

describe('resolver guards', () => {
  it('sends nothing when the share link row is missing', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: null }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('missing-link', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })

  it('sends nothing when PostgREST returns an error', async () => {
    mockCreateServiceClient.mockReturnValue(
      buildClient({ data: null, error: { message: 'column does not exist' } }),
    )
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })

  it('sends nothing when the sharer has no contact_email', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      data: { ...validRow, profile: { first_name: 'Ivan', last_name: 'Petrov', contact_email: null } },
    }))
    const { notifySharerOfAttendance } = await import('@/lib/notifications/share-events')

    notifySharerOfAttendance('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })

  it('sends nothing when the event is missing', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: { ...validRow, event: null } }))
    const { notifySharerOfCancellation } = await import('@/lib/notifications/share-events')

    notifySharerOfCancellation('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })
})
