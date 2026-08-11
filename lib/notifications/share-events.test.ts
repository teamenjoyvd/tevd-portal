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
/** Every consumeEmailCap call, in order — proves the bucket is template-scoped. */
const capCalls: { recipient: string; template?: string; max: number }[] = []
const mockConsumeEmailCap = vi.fn(() => Promise.resolve(true))
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
// These are notifications, not transactional mail (2608-DEV-715): the admin
// master switch and per-template toggle must apply, so the helpers dispatch
// through sendNotificationEmail.
vi.mock('@/lib/email/send', () => ({
  sendNotificationEmail: vi.fn((opts: { to: string; template: string }) => {
    sentEmails.push({ to: opts.to, template: opts.template })
    return Promise.resolve()
  }),
}))
vi.mock('@/lib/rate-limit', () => ({
  consumeEmailCap: (args: { recipient: string; template?: string; max: number }) => {
    capCalls.push({ recipient: args.recipient, template: args.template, max: args.max })
    return mockConsumeEmailCap()
  },
}))
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: () => Promise.resolve({ users: { getUser: (id: string) => mockGetUser(id) } }),
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
  capCalls.length = 0
  capturedSelect = ''
  // clearAllMocks wipes calls, not implementations — restate both defaults so
  // one test's override cannot leak into the next.
  mockConsumeEmailCap.mockImplementation(() => Promise.resolve(true))
  mockGetUser.mockImplementation(() =>
    Promise.resolve({ primaryEmailAddress: { emailAddress: 'clerk@example.com' } }),
  )
})

type ShareLinkRow = {
  lang: string
  profile: {
    first_name: string
    last_name: string
    contact_email: string | null
    clerk_id: string | null
  } | null
  event: { title: string } | null
}

const validRow: ShareLinkRow = {
  lang: 'en',
  profile: {
    first_name: 'Ivan',
    last_name: 'Petrov',
    contact_email: 'sharer@example.com',
    clerk_id: 'user_ivan',
  },
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

  it('sends nothing when the sharer has neither contact_email nor clerk_id', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      data: {
        ...validRow,
        profile: { first_name: 'Ivan', last_name: 'Petrov', contact_email: null, clerk_id: null },
      },
    }))
    const { notifySharerOfAttendance } = await import('@/lib/notifications/share-events')

    notifySharerOfAttendance('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('sends nothing when the event is missing', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: { ...validRow, event: null } }))
    const { notifySharerOfCancellation } = await import('@/lib/notifications/share-events')

    notifySharerOfCancellation('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })
})

// -- Clerk fallback (2608-DEV-715) ----------------------------------------------
// 12 of 68 active share links belonged to a sharer with a NULL contact_email on
// 2026-08-09 — every one of them a silent non-delivery before this fallback.

describe('sharer email resolution', () => {
  const noContactEmail: ShareLinkRow = {
    ...validRow,
    profile: { first_name: 'Ivan', last_name: 'Petrov', contact_email: null, clerk_id: 'user_ivan' },
  }

  it('falls back to the Clerk primary email when contact_email is null', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: noContactEmail }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(mockGetUser).toHaveBeenCalledWith('user_ivan')
    expect(sentEmails).toEqual([{ to: 'clerk@example.com', template: 'share_guest_registered' }])
  })

  it('prefers contact_email over Clerk and never calls Clerk when it is set', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toEqual([{ to: 'sharer@example.com', template: 'share_guest_registered' }])
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('treats a blank contact_email as absent and still falls back', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      data: {
        ...validRow,
        profile: { first_name: 'Ivan', last_name: 'Petrov', contact_email: '   ', clerk_id: 'user_ivan' },
      },
    }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toEqual([{ to: 'clerk@example.com', template: 'share_guest_registered' }])
  })

  it('sends nothing when the Clerk lookup throws — an outage must not escape', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: noContactEmail }))
    mockGetUser.mockImplementation(() => Promise.reject(new Error('clerk down')))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })

  it('sends nothing when the Clerk user has no primary email', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: noContactEmail }))
    mockGetUser.mockImplementation(() => Promise.resolve({ primaryEmailAddress: null }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(sentEmails).toHaveLength(0)
  })

  it('selects clerk_id alongside contact_email', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(capturedSelect).toContain('clerk_id')
  })
})

// -- Daily cap (2608-DEV-715) ---------------------------------------------------
// A widely-circulated share link had no upper bound on the mail it could
// generate for its owner: the helpers bypassed both the cap and the admin gates.

describe('daily email cap', () => {
  it('sends nothing when the cap is spent', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    mockConsumeEmailCap.mockImplementation(() => Promise.resolve(false))
    const { notifySharerOfRegistration } = await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()

    expect(capCalls).toHaveLength(1)
    expect(sentEmails).toHaveLength(0)
  })

  it('scopes the bucket per template, so a registration burst cannot starve the cancellation notice', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({ data: validRow }))
    const { notifySharerOfRegistration, notifySharerOfCancellation } =
      await import('@/lib/notifications/share-events')

    notifySharerOfRegistration('link-1', 'Jane Guest')
    await flush()
    notifySharerOfCancellation('link-1', 'Jane Guest')
    await flush()

    expect(capCalls).toEqual([
      { recipient: 'sharer@example.com', template: 'share_guest_registered', max: 10 },
      { recipient: 'sharer@example.com', template: 'share_guest_cancelled', max: 10 },
    ])
  })
})
