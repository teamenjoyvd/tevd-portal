import { beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for registerGuest (issue 2607-DEV-587):
//  - token reuse: a still-valid prior registration resends the SAME magic link
//    (UPDATE name/share_link_id) rather than minting a fresh token; an expired
//    or absent one mints a new token via upsert.
//  - base URL: the magic link is built from getBaseUrl() (NEXT_PUBLIC_APP_URL
//    first), not the raw request host.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()
let capturedMagicLink = ''

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
vi.mock('@/lib/email/send', () => ({
  sendTransactionalEmail: vi.fn(() => Promise.resolve({ sent: true })),
}))
vi.mock('@/lib/email/templates/render', () => ({
  // Capture the magic link handed to the email component.
  renderEmailTemplate: (el: { props: { magicLinkUrl: string } }) => {
    capturedMagicLink = el.props.magicLinkUrl
    return Promise.resolve('<html></html>')
  },
}))
vi.mock('@/lib/email/templates/GuestEventMagicLinkEmail', () => ({
  GuestEventMagicLinkEmail: () => null,
}))
vi.mock('@/lib/notifications/share-events', () => ({
  notifySharerOfRegistration: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'req-host.example']])),
}))

// -- Supabase mock ------------------------------------------------------------

type Row = Record<string, unknown> | null

function buildClient(existing: Row) {
  const updateSpy = vi.fn(() => ({
    eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }))
  const upsertSpy = vi.fn(() => Promise.resolve({ error: null }))

  const event = { id: 'e', title: 'Trip Kickoff', allow_guest_registration: true }

  const client = {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
        }
      }
      if (table === 'guest_registrations') {
        const selectChain: Record<string, unknown> = {
          eq: () => selectChain,
          maybeSingle: () => Promise.resolve({ data: existing, error: null }),
        }
        return { select: () => selectChain, update: updateSpy, upsert: upsertSpy }
      }
      throw new Error(`unexpected table ${table}`)
    },
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  }
  return { client, updateSpy, upsertSpy }
}

function form(): FormData {
  const fd = new FormData()
  fd.set('name', 'Jane Guest')
  fd.set('email', 'jane@example.com')
  fd.set('eventId', '123e4567-e89b-12d3-a456-426614174000')
  return fd
}

const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  capturedMagicLink = ''
  process.env.NEXT_PUBLIC_APP_URL = 'https://portal.example'
})

describe('registerGuest — token reuse', () => {
  it('reuses the existing token when the prior link is still valid', async () => {
    const { client, updateSpy, upsertSpy } = buildClient({
      token: 'existing-token-abc',
      expires_at: new Date(Date.now() + 24 * HOUR).toISOString(),
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(upsertSpy).not.toHaveBeenCalled()
    expect(capturedMagicLink).toContain('existing-token-abc')
  })

  it('mints a fresh token when the prior link has expired', async () => {
    const { client, updateSpy, upsertSpy } = buildClient({
      token: 'existing-token-abc',
      expires_at: new Date(Date.now() - HOUR).toISOString(),
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).not.toHaveBeenCalled()
    expect(capturedMagicLink).not.toContain('existing-token-abc')
  })

  it('mints a fresh token when there is no prior registration', async () => {
    const { client, updateSpy, upsertSpy } = buildClient(null)
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('registerGuest — base URL', () => {
  it('builds the magic link from NEXT_PUBLIC_APP_URL, not the request host', async () => {
    const { client } = buildClient(null)
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    await registerGuest({ success: false }, form())

    expect(capturedMagicLink.startsWith('https://portal.example/events/')).toBe(true)
    expect(capturedMagicLink).not.toContain('req-host.example')
  })
})
