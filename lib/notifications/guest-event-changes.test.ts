import { beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for the event-change/cancel guest notifier (issue 2607-DEV-592):
//  - diffEventFields: pure diff of the tracked fields.
//  - notifyGuestsOfEventUpdate: no-op on an empty diff; respects consumeEmailCap
//    per recipient; sends to all active (non-cancelled, non-expired) registrants.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()
const mockConsumeEmailCap = vi.fn()
const sentEmails: { to: string; template: string }[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
vi.mock('@/lib/rate-limit', () => ({
  consumeEmailCap: (...args: unknown[]) => mockConsumeEmailCap(...args),
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
vi.mock('@/lib/email/templates/GuestEventUpdatedEmail', () => ({
  GuestEventUpdatedEmail: () => null,
}))
vi.mock('@/lib/email/templates/GuestEventCancelledEmail', () => ({
  GuestEventCancelledEmail: () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  sentEmails.length = 0
  mockConsumeEmailCap.mockResolvedValue(true)
})

// -- diffEventFields ------------------------------------------------------------

describe('diffEventFields', () => {
  it('returns an empty array when nothing tracked changed', async () => {
    const { diffEventFields } = await import('@/lib/notifications/guest-event-changes')
    const row = { start_time: '2026-08-01T10:00:00Z', end_time: '2026-08-01T12:00:00Z', meeting_url: 'https://meet.example/x' }
    expect(diffEventFields(row, { ...row })).toEqual([])
  })

  it('reports a changed field with formatted old/new values', async () => {
    const { diffEventFields } = await import('@/lib/notifications/guest-event-changes')
    const prev = { start_time: '2026-08-01T10:00:00Z', end_time: '2026-08-01T12:00:00Z', meeting_url: 'https://meet.example/old' }
    const next = { ...prev, meeting_url: 'https://meet.example/new' }
    const diff = diffEventFields(prev, next)
    expect(diff).toEqual([{ field: 'meeting_url', oldValue: 'https://meet.example/old', newValue: 'https://meet.example/new' }])
  })

  it('reports multiple changed fields', async () => {
    const { diffEventFields } = await import('@/lib/notifications/guest-event-changes')
    const prev = { start_time: '2026-08-01T10:00:00Z', end_time: '2026-08-01T12:00:00Z', meeting_url: null }
    const next = { start_time: '2026-08-02T10:00:00Z', end_time: '2026-08-02T12:00:00Z', meeting_url: null }
    const diff = diffEventFields(prev, next)
    expect(diff.map(d => d.field).sort()).toEqual(['end_time', 'start_time'])
  })

  it('treats null and empty-string meeting_url as unchanged', async () => {
    const { diffEventFields } = await import('@/lib/notifications/guest-event-changes')
    const prev = { start_time: '2026-08-01T10:00:00Z', end_time: '2026-08-01T12:00:00Z', meeting_url: null }
    const next = { ...prev, meeting_url: '' }
    expect(diffEventFields(prev, next)).toEqual([])
  })
})

// -- notifyGuestsOfEventUpdate --------------------------------------------------

function buildClient(opts: { title?: string; regs?: { email: string | null; name: string; lang: string }[] }) {
  const event = { title: opts.title ?? 'Trip Kickoff' }
  const regs = opts.regs ?? [{ email: 'jane@example.com', name: 'Jane Guest', lang: 'en' }]
  return {
    from: (table: string) => {
      if (table === 'calendar_events') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: event, error: null }) }) }) }
      }
      if (table === 'guest_registrations') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                // Mirrors the real chain since 2608-DEV-705: the expiry filter
                // is `.or('expires_at.is.null,expires_at.gt.<now>')`, not
                // `.gt(...)`, so member rows (expires_at NULL) are not treated
                // as expired.
                or: () => Promise.resolve({ data: regs, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

describe('notifyGuestsOfEventUpdate', () => {
  it('does not touch the DB when the diff is empty', async () => {
    const { notifyGuestsOfEventUpdate } = await import('@/lib/notifications/guest-event-changes')
    notifyGuestsOfEventUpdate('event-1', [])
    await new Promise(r => setTimeout(r, 0))
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })

  it('sends to all active registrants under the daily cap', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      regs: [
        { email: 'a@example.com', name: 'A', lang: 'en' },
        { email: 'b@example.com', name: 'B', lang: 'bg' },
      ],
    }))
    const { notifyGuestsOfEventUpdate } = await import('@/lib/notifications/guest-event-changes')

    notifyGuestsOfEventUpdate('event-1', [{ field: 'start_time', oldValue: 'old', newValue: 'new' }])
    await new Promise(r => setTimeout(r, 10))

    expect(sentEmails.map(e => e.to).sort()).toEqual(['a@example.com', 'b@example.com'])
    expect(sentEmails.every(e => e.template === 'guest_event_updated')).toBe(true)
  })

  it('skips member registrations, whose email is NULL (2608-DEV-705)', async () => {
    // Member rows now come back from the widened expires_at filter. Their
    // address lives on profiles, not here — delivering to them is
    // 2608-DEV-707's job. This helper must drop them, never mail `null`.
    mockCreateServiceClient.mockReturnValue(buildClient({
      regs: [
        { email: 'guest@example.com', name: 'Guest', lang: 'en' },
        { email: null, name: 'Member', lang: 'bg' },
      ],
    }))
    const { notifyGuestsOfEventUpdate } = await import('@/lib/notifications/guest-event-changes')

    notifyGuestsOfEventUpdate('event-1', [{ field: 'start_time', oldValue: 'old', newValue: 'new' }])
    await new Promise(r => setTimeout(r, 10))

    expect(sentEmails.map(e => e.to)).toEqual(['guest@example.com'])
  })

  it('skips a recipient over the daily email cap', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      regs: [{ email: 'capped@example.com', name: 'Capped', lang: 'en' }],
    }))
    mockConsumeEmailCap.mockResolvedValue(false)
    const { notifyGuestsOfEventUpdate } = await import('@/lib/notifications/guest-event-changes')

    notifyGuestsOfEventUpdate('event-1', [{ field: 'start_time', oldValue: 'old', newValue: 'new' }])
    await new Promise(r => setTimeout(r, 10))

    expect(sentEmails).toHaveLength(0)
  })
})

// -- notifyGuestsOfEventCancellation --------------------------------------------

describe('notifyGuestsOfEventCancellation', () => {
  it('is a no-op with an empty recipient list', async () => {
    const { notifyGuestsOfEventCancellation } = await import('@/lib/notifications/guest-event-changes')
    notifyGuestsOfEventCancellation('Trip Kickoff', [])
    await new Promise(r => setTimeout(r, 0))
    expect(sentEmails).toHaveLength(0)
  })

  it('sends the cancellation template to every given recipient', async () => {
    const { notifyGuestsOfEventCancellation } = await import('@/lib/notifications/guest-event-changes')
    notifyGuestsOfEventCancellation('Trip Kickoff', [
      { email: 'a@example.com', name: 'A', lang: 'en' },
      { email: 'b@example.com', name: 'B', lang: 'bg' },
    ])
    await new Promise(r => setTimeout(r, 10))

    expect(sentEmails.map(e => e.to).sort()).toEqual(['a@example.com', 'b@example.com'])
    expect(sentEmails.every(e => e.template === 'guest_event_cancelled')).toBe(true)
  })
})
