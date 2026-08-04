import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for the atomic rate-limit guards (issue 2608-DEV-625):
//  - each guard builds the documented bucket key and forwards window/max
//    unchanged to the consume_rate_limit RPC;
//  - the RPC's boolean is the answer, and anything that is not an explicit
//    `true` denies (fail closed);
//  - only the "function is not deployed" codes fall back to the pre-625
//    count-based path — every other RPC error denies without falling back.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

type RpcResult = { data: boolean | null; error: { code?: string | null; message?: string } | null }

/** Thenable chain accepting any sequence of .eq()/.gte(), resolving to { count }. */
function countChain(count: number, error: { message: string } | null = null) {
  const chain: Record<string, unknown> = {
    eq:  () => chain,
    gte: () => chain,
    then: (resolve: (v: { count: number | null; error: unknown }) => void) =>
      resolve({ count: error ? null : count, error }),
  }
  return chain
}

/**
 * `rpc` answers with `rpcResult`; `from` serves the legacy count path, so a
 * single client covers both the RPC branch and the fallback branch.
 */
function buildClient(opts: {
  rpcResult: RpcResult
  count?: number
  countError?: { message: string } | null
}) {
  const rpcSpy = vi.fn(() => Promise.resolve(opts.rpcResult))
  const client = {
    rpc: rpcSpy,
    from: (table: string) => {
      if (table === 'notification_delivery_log' || table === 'guest_registrations') {
        return { select: () => countChain(opts.count ?? 0, opts.countError ?? null) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return { client, rpcSpy }
}

const HOUR = 60 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  // The fail-closed paths log deliberately; keep the suite output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// -- consumeEmailCap ----------------------------------------------------------

describe('consumeEmailCap', () => {
  it('keys on the recipient alone when no template is given, forwarding window and max', async () => {
    const { client, rpcSpy } = buildClient({ rpcResult: { data: true, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    const allowed = await consumeEmailCap({
      recipient: 'jane@example.com',
      windowMs:  24 * HOUR,
      max:       10,
    })

    expect(allowed).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith('consume_rate_limit', {
      p_key:       'email:jane@example.com',
      p_window_ms: 24 * HOUR,
      p_max:       10,
    })
  })

  it('narrows the key with the template so the two caps count independently', async () => {
    const { client, rpcSpy } = buildClient({ rpcResult: { data: true, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await consumeEmailCap({
      recipient: 'jane@example.com',
      template:  'guest_event_magic_link',
      windowMs:  HOUR,
      max:       3,
    })

    expect(rpcSpy).toHaveBeenCalledWith('consume_rate_limit', {
      p_key:       'email:jane@example.com:guest_event_magic_link',
      p_window_ms: HOUR,
      p_max:       3,
    })
  })

  it('denies when the RPC refuses the slot', async () => {
    const { client } = buildClient({ rpcResult: { data: false, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })

  it('denies when the RPC returns null rather than a boolean', async () => {
    const { client } = buildClient({ rpcResult: { data: null, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })
})

// -- consumeRegistrationSlot --------------------------------------------------

describe('consumeRegistrationSlot', () => {
  it('keys on the share link when the load carried one', async () => {
    const { client, rpcSpy } = buildClient({ rpcResult: { data: true, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeRegistrationSlot } = await import('@/lib/rate-limit')

    const allowed = await consumeRegistrationSlot({
      shareLinkId: 'link-1',
      eventId:     'event-1',
      windowMs:    HOUR,
      max:         30,
    })

    expect(allowed).toBe(true)
    expect(rpcSpy).toHaveBeenCalledWith('consume_rate_limit', {
      p_key:       'guest-reg:link:link-1',
      p_window_ms: HOUR,
      p_max:       30,
    })
  })

  it('falls back to the event key for token-less loads', async () => {
    const { client, rpcSpy } = buildClient({ rpcResult: { data: true, error: null } })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeRegistrationSlot } = await import('@/lib/rate-limit')

    await consumeRegistrationSlot({ shareLinkId: null, eventId: 'event-1', windowMs: HOUR, max: 30 })

    expect(rpcSpy).toHaveBeenCalledWith('consume_rate_limit', {
      p_key:       'guest-reg:event:event-1',
      p_window_ms: HOUR,
      p_max:       30,
    })
  })
})

// -- Fail closed --------------------------------------------------------------

describe('fail-closed behaviour', () => {
  it('denies on an arbitrary RPC error without consulting the legacy count path', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
      // A count low enough to ALLOW — proving the fallback was not taken.
      count: 0,
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })

  it('never writes the recipient address into the failure log (PR #693 review)', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: '57014', message: 'statement timeout' } },
    })
    mockCreateServiceClient.mockReturnValue(client)
    const errorSpy = vi.mocked(console.error)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await consumeEmailCap({
      recipient: 'jane@example.com',
      template:  'guest_event_magic_link',
      windowMs:  HOUR,
      max:       3,
    })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const logged = JSON.stringify(errorSpy.mock.calls[0])
    expect(logged).not.toContain('jane@example.com')
    expect(logged).not.toContain('jane')
    // The scope still identifies WHICH guard tripped, and the digest still lets
    // repeated failures for one recipient be correlated.
    expect(logged).toContain('email+template')
  })

  it('denies when the RPC error carries no code at all', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { message: 'network unreachable' } },
      count: 0,
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })
})

// -- Transitional fallback ----------------------------------------------------
// Covers the window where Vercel has deployed this code but the gated
// migrate-prod run has not yet created the function.

describe('missing-RPC fallback', () => {
  it('PGRST202 falls back to the count path and allows when under the cap', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      count: 2,
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(true)
  })

  it('PGRST202 falls back and denies once the count has reached the cap', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      count: 3,
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })

  it('42883 falls back for the registration throttle too', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: '42883', message: 'function does not exist' } },
      count: 29,
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeRegistrationSlot } = await import('@/lib/rate-limit')

    await expect(consumeRegistrationSlot({ shareLinkId: 'link-1', eventId: 'event-1', windowMs: HOUR, max: 30 }))
      .resolves.toBe(true)
  })

  it('denies when the fallback count query itself errors', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      count: 0,
      countError: { message: 'relation does not exist' },
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })
})
