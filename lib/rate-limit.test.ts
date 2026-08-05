import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for the atomic rate-limit guards (issue 2608-DEV-625):
//  - each guard builds the documented bucket key and forwards window/max
//    unchanged to the consume_rate_limit RPC;
//  - the RPC's boolean is the answer, and anything that is not an explicit
//    `true` denies (fail closed);
//  - EVERY RPC error denies, with no special-cased codes. 2608-DEV-696 removed
//    the transitional PGRST202/42883 fallback to the pre-625 count path, so
//    there is no longer any error that reaches a table read.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

type RpcResult = { data: boolean | null; error: { code?: string | null; message?: string } | null }

/**
 * `rpc` answers with `rpcResult`. There is deliberately no working `from` seam:
 * 2608-DEV-696 removed the legacy count path, so ANY table read from these
 * guards is a regression. Throwing here keeps that guarantee actively asserted
 * — a reintroduced fallback fails the suite loudly instead of quietly passing
 * because the seam went away with it.
 */
function buildClient(opts: { rpcResult: RpcResult }) {
  const rpcSpy = vi.fn(() => Promise.resolve(opts.rpcResult))
  const client = {
    rpc: rpcSpy,
    from: (table: string) => {
      throw new Error(`unexpected table read: ${table} — the guards must not query tables`)
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
  it('denies on an arbitrary RPC error without reading any table', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } },
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
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })
})

// -- Missing RPC is no longer special -----------------------------------------
// These codes USED to divert to the pre-625 count path (removed in
// 2608-DEV-696). They are asserted explicitly, rather than folded into the
// generic error case above, because reintroducing a fallback would be a silent
// regression on a public abuse surface: the count path is racy by construction,
// which is the whole reason #625 replaced it.

describe('missing-RPC codes deny like any other error', () => {
  it('PGRST202 denies instead of falling back to a count', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeEmailCap } = await import('@/lib/rate-limit')

    await expect(consumeEmailCap({ recipient: 'jane@example.com', windowMs: HOUR, max: 3 }))
      .resolves.toBe(false)
  })

  it('42883 denies for the registration throttle too', async () => {
    const { client } = buildClient({
      rpcResult: { data: null, error: { code: '42883', message: 'function does not exist' } },
    })
    mockCreateServiceClient.mockReturnValue(client)
    const { consumeRegistrationSlot } = await import('@/lib/rate-limit')

    await expect(consumeRegistrationSlot({ shareLinkId: 'link-1', eventId: 'event-1', windowMs: HOUR, max: 30 }))
      .resolves.toBe(false)
  })
})
