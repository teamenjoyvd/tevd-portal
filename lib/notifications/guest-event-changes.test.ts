import { beforeEach, describe, expect, it, vi } from 'vitest'

// Unit coverage for the event-change/cancel guest notifier (issue 2607-DEV-592):
//  - diffEventFields: pure diff of the tracked fields.
//  - notifyGuestsOfEventUpdate: no-op on an empty diff; respects checkEmailCap
//    per recipient; sends to all active (non-cancelled, non-expired) registrants.

// -- Seams --------------------------------------------------------------------

const mockCreateServiceClient = vi.fn()
const mockCheckEmailCap = vi.fn()
const sentEmails: { to: string; template: string }[] = []

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkEmailCap: (...args: unknown[]) => mockCheckEmailCap(...args),
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
  mockCheckEmailCap.mockResolvedValue(true)
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
})

// -- notifyGuestsOfEventUpdate --------------------------------------------------

function buildClient(opts: { title?: string; regs?: { email: string; name: string; lang: string }[] }) {
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
                gt: () => Promise.resolve({ data: regs, error: null }),
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

  it('skips a recipient over the daily email cap', async () => {
    mockCreateServiceClient.mockReturnValue(buildClient({
      regs: [{ email: 'capped@example.com', name: 'Capped', lang: 'en' }],
    }))
    mockCheckEmailCap.mockResolvedValue(false)
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
