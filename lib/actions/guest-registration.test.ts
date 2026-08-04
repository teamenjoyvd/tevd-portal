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
  notifySharerOfCancellation: vi.fn(),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'req-host.example']])),
}))

// Since 2608-DEV-625 the abuse guards CONSUME a slot through the
// consume_rate_limit RPC instead of running a count query, so there is no
// count for a Supabase fixture to fake. They are mocked at the module boundary
// here; the key/window/max they send lives in lib/rate-limit.test.ts.
const mockConsumeEmailCap = vi.fn()
const mockConsumeRegistrationSlot = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  consumeEmailCap:         (...args: unknown[]) => mockConsumeEmailCap(...args),
  consumeRegistrationSlot: (...args: unknown[]) => mockConsumeRegistrationSlot(...args),
}))

// -- Supabase mock ------------------------------------------------------------

type Row = Record<string, unknown> | null

function buildClient(existing: Row) {
  const updateSpy = vi.fn(() => ({
    eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }))
  const upsertSpy = vi.fn(() => Promise.resolve({ error: null }))

  const event = {
    id: 'e',
    title: 'Trip Kickoff',
    allow_guest_registration: true,
    end_time: new Date(Date.now() + 24 * HOUR).toISOString(),
  }

  const client = {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }),
        }
      }
      if (table === 'guest_registrations') {
        return {
          select: (_cols: string, sel?: { count?: string; head?: boolean }) => {
            // Capacity count only — the throttle is module-mocked above and no
            // longer issues a count query (2608-DEV-625).
            if (sel?.count) return countChain(0)
            const selectChain: Record<string, unknown> = {
              eq: () => selectChain,
              maybeSingle: () => Promise.resolve({ data: existing, error: null }),
            }
            return selectChain
          },
          update: updateSpy,
          upsert: upsertSpy,
        }
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
  // Under every limit by default; the abuse-protection describes override this.
  mockConsumeEmailCap.mockResolvedValue(true)
  mockConsumeRegistrationSlot.mockResolvedValue(true)
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

// -- Lang passthrough (2607-DEV-589) ------------------------------------------

describe('registerGuest — lang passthrough', () => {
  it('stores the submitted lang on a fresh registration (upsert)', async () => {
    const { client, upsertSpy } = buildClient(null)
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const fd = form()
    fd.set('lang', 'bg')
    await registerGuest({ success: false }, fd)

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'bg' }),
      expect.anything(),
    )
  })

  it('defaults to en when no lang field is submitted', async () => {
    const { client, upsertSpy } = buildClient(null)
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    await registerGuest({ success: false }, form())

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ lang: 'en' }),
      expect.anything(),
    )
  })

  it('stores the submitted lang when reusing an existing token (update)', async () => {
    const { client, updateSpy } = buildClient({
      token: 'existing-token-abc',
      expires_at: new Date(Date.now() + 24 * HOUR).toISOString(),
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const fd = form()
    fd.set('lang', 'bg')
    await registerGuest({ success: false }, fd)

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ lang: 'bg' }))
  })
})

// -- resendGuestLink — neutrality + rate cap (2607-DEV-589) -------------------

// Flexible thenable chain: supports any sequence of .eq()/.gte() calls (real
// call shape differs between the template-filtered hourly check and the
// unfiltered daily check), then resolves to { count } on await.
function countChain(count: number) {
  const chain: { eq: () => typeof chain; gte: () => typeof chain; is: () => typeof chain; then: (resolve: (v: { count: number; error: null }) => void) => void } = {
    eq: () => chain,
    gte: () => chain,
    is: () => chain,
    then: (resolve) => resolve({ count, error: null }),
  }
  return chain
}

function buildResendClient(opts: {
  event?: Record<string, unknown> | null
  reg?: Record<string, unknown> | null
}) {
  const event = opts.event === undefined
    ? { id: 'e', title: 'Trip Kickoff', allow_guest_registration: true, end_time: new Date(Date.now() + 24 * HOUR).toISOString() }
    : opts.event
  const reg = opts.reg === undefined
    ? { id: 'r1', name: 'Jane Guest', token: 'tok-123', lang: 'en' }
    : opts.reg

  const updateSpy = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))

  const client = {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }) }
      }
      if (table === 'guest_registrations') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: reg, error: null }) }) }) }),
          update: updateSpy,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { client, updateSpy }
}

describe('resendGuestLink — neutrality', () => {
  it('returns the same neutral result when the registration exists', async () => {
    const { client } = buildResendClient({})
    mockCreateServiceClient.mockReturnValue(client)
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    const res = await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'jane@example.com')
    expect(res).toEqual({ success: true })
  })

  it('returns the same neutral result when the registration does not exist', async () => {
    const { client } = buildResendClient({ reg: null })
    mockCreateServiceClient.mockReturnValue(client)
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    const res = await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'nobody@example.com')
    expect(res).toEqual({ success: true })
  })

  it('returns the same neutral result when the event does not exist', async () => {
    const { client } = buildResendClient({ event: null })
    mockCreateServiceClient.mockReturnValue(client)
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    const res = await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'jane@example.com')
    expect(res).toEqual({ success: true })
  })
})

describe('resendGuestLink — rate cap', () => {
  it('sends when under the hourly cap', async () => {
    const { client } = buildResendClient({})
    mockCreateServiceClient.mockReturnValue(client)
    const sendModule = await import('@/lib/email/send')
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'jane@example.com')
    expect(sendModule.sendTransactionalEmail).toHaveBeenCalledTimes(1)
  })

  it('no-ops (does not send a 4th email) once the hourly cap is reached', async () => {
    const { client } = buildResendClient({})
    // First consume call in resendGuestLink is the hourly template-scoped cap.
    mockConsumeEmailCap.mockResolvedValueOnce(false)
    mockCreateServiceClient.mockReturnValue(client)
    const sendModule = await import('@/lib/email/send')
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    const res = await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'jane@example.com')
    expect(sendModule.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true })
  })

  it('no-ops once the overall daily cap is reached, even under the hourly cap (2607-DEV-591)', async () => {
    const { client } = buildResendClient({})
    // Call order is load-bearing: hourly template-scoped cap first (allows),
    // overall daily cap second (denies). Asserted here so a reordering of the
    // two consumeEmailCap calls in resendGuestLink fails this test.
    mockConsumeEmailCap
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    mockCreateServiceClient.mockReturnValue(client)
    const sendModule = await import('@/lib/email/send')
    const { resendGuestLink } = await import('@/lib/actions/guest-registration')

    const res = await resendGuestLink('123e4567-e89b-12d3-a456-426614174000', 'jane@example.com')
    expect(sendModule.sendTransactionalEmail).not.toHaveBeenCalled()
    expect(res).toEqual({ success: true })
  })
})

// -- registerGuest — capacity (2607-DEV-590) ----------------------------------

function buildCapacityClient(opts: { guestCapacity: number | null; activeCount: number; existing?: Row }) {
  const event = {
    id: 'e',
    title: 'Trip Kickoff',
    allow_guest_registration: true,
    end_time: new Date(Date.now() + 24 * HOUR).toISOString(),
    guest_capacity: opts.guestCapacity,
  }
  const upsertSpy = vi.fn(() => Promise.resolve({ error: null }))
  const updateSpy = vi.fn(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }))
  const client = {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }) }
      }
      if (table === 'guest_registrations') {
        return {
          select: (_cols: string, sel?: { count?: string; head?: boolean }) => {
            // The capacity count is now the ONLY count query registerGuest
            // runs — the throttle became an RPC in 2608-DEV-625.
            if (sel?.count) return countChain(opts.activeCount)
            return { eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.existing ?? null, error: null }) }) }) }
          },
          update: updateSpy,
          upsert: upsertSpy,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  }
  return { client, upsertSpy, updateSpy }
}

describe('registerGuest — capacity boundary', () => {
  it('rejects a new guest when active registrations already meet capacity', async () => {
    const { client, upsertSpy } = buildCapacityClient({ guestCapacity: 2, activeCount: 2 })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/capacity/i)
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('allows a new guest when under capacity', async () => {
    const { client, upsertSpy } = buildCapacityClient({ guestCapacity: 2, activeCount: 1 })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
  })

  it('does not count an already-active guest resubmitting toward their own capacity check', async () => {
    const { client, updateSpy } = buildCapacityClient({
      guestCapacity: 1,
      activeCount: 1, // this same guest is the 1 counted
      existing: { token: 'existing-token-abc', expires_at: new Date(Date.now() + 24 * HOUR).toISOString(), cancelled_at: null },
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })
})

// -- registerGuest — re-register after cancel (2607-DEV-590) ------------------

describe('registerGuest — re-register after cancel', () => {
  it('clears cancelled_at and mints a fresh token, never reusing the old one', async () => {
    const { client, updateSpy, upsertSpy } = buildClient({
      token: 'old-cancelled-token',
      expires_at: new Date(Date.now() + 24 * HOUR).toISOString(),
      cancelled_at: new Date().toISOString(),
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(updateSpy).not.toHaveBeenCalled()
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ cancelled_at: null }),
      expect.anything(),
    )
    expect(capturedMagicLink).not.toContain('old-cancelled-token')
  })
})

// -- cancelGuestRegistration (2607-DEV-590) -----------------------------------

function buildCancelClient(reg: Row) {
  const updateSpy = vi.fn(() => ({ eq: () => ({ is: () => Promise.resolve({ error: null }) }) }))
  const client = {
    from: (table: string) => {
      if (table === 'guest_registrations') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: reg, error: null }) }) }),
          update: updateSpy,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { client, updateSpy }
}

function cancelForm(token: string): FormData {
  const fd = new FormData()
  fd.set('token', token)
  return fd
}

describe('cancelGuestRegistration', () => {
  it('marks an active registration as cancelled', async () => {
    const { client, updateSpy } = buildCancelClient({ id: 'r1', name: 'Jane Guest', share_link_id: null, cancelled_at: null })
    mockCreateServiceClient.mockReturnValue(client)
    const { cancelGuestRegistration } = await import('@/lib/actions/guest-registration')

    const res = await cancelGuestRegistration({ success: false }, cancelForm('tok-123'))

    expect(res).toEqual({ success: true })
    expect(updateSpy).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — cancelling an already-cancelled registration is a no-op success', async () => {
    const { client, updateSpy } = buildCancelClient({ id: 'r1', name: 'Jane Guest', share_link_id: null, cancelled_at: new Date().toISOString() })
    mockCreateServiceClient.mockReturnValue(client)
    const { cancelGuestRegistration } = await import('@/lib/actions/guest-registration')

    const res = await cancelGuestRegistration({ success: false }, cancelForm('tok-123'))

    expect(res).toEqual({ success: true })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('returns an error for an unknown token', async () => {
    const { client, updateSpy } = buildCancelClient(null)
    mockCreateServiceClient.mockReturnValue(client)
    const { cancelGuestRegistration } = await import('@/lib/actions/guest-registration')

    const res = await cancelGuestRegistration({ success: false }, cancelForm('nonexistent'))

    expect(res.success).toBe(false)
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

// -- registerGuest — abuse protection (2607-DEV-591) --------------------------

// Both guards are module-mocked (see the seams block) — this fixture only has
// to keep the surrounding registration flow alive while they allow or deny.
function buildAbuseClient(opts: { existing?: Row } = {}) {
  const existing = opts.existing ?? null

  const event = {
    id: 'e',
    title: 'Trip Kickoff',
    allow_guest_registration: true,
    end_time: new Date(Date.now() + 24 * HOUR).toISOString(),
    guest_capacity: null,
  }
  const upsertSpy = vi.fn(() => Promise.resolve({ error: null }))
  const updateSpy = vi.fn(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }))

  const client = {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }) }
      }
      if (table === 'guest_registrations') {
        return {
          select: (_cols: string, sel?: { count?: string; head?: boolean }) => {
            // guest_capacity is null in this fixture, so no capacity count runs.
            if (sel?.count) return countChain(0)
            return { eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }) }) }
          },
          update: updateSpy,
          upsert: upsertSpy,
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  }
  return { client, upsertSpy, updateSpy }
}

describe('registerGuest — honeypot', () => {
  it('short-circuits to a generic success, no DB client and no send, when the honeypot field is filled', async () => {
    mockCreateServiceClient.mockClear()
    const sendModule = await import('@/lib/email/send')
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const fd = form()
    fd.set('website', 'https://spam.example')
    const res = await registerGuest({ success: false }, fd)

    expect(res).toEqual({ success: true })
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    expect(sendModule.sendTransactionalEmail).not.toHaveBeenCalled()
  })
})

describe('registerGuest — registration throttle', () => {
  it('rejects with a bilingual message once the per-link/event throttle is reached', async () => {
    const { client, upsertSpy } = buildAbuseClient()
    mockConsumeRegistrationSlot.mockResolvedValue(false)
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(false)
    expect(res.error).toBeTruthy()
    expect(upsertSpy).not.toHaveBeenCalled()
  })

  it('allows registration when under the throttle', async () => {
    const { client, upsertSpy } = buildAbuseClient()
    mockCreateServiceClient.mockReturnValue(client)
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledTimes(1)
  })
})

describe('registerGuest — overall email cap', () => {
  it('registers but skips the send once the daily email cap is reached', async () => {
    const { client, upsertSpy } = buildAbuseClient()
    mockConsumeEmailCap.mockResolvedValue(false)
    mockCreateServiceClient.mockReturnValue(client)
    const sendModule = await import('@/lib/email/send')
    const { registerGuest } = await import('@/lib/actions/guest-registration')

    const res = await registerGuest({ success: false }, form())

    expect(res).toEqual({ success: true })
    expect(upsertSpy).toHaveBeenCalledTimes(1)
    expect(sendModule.sendTransactionalEmail).not.toHaveBeenCalled()
  })
})
