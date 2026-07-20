// ── app/api/profile/event-shares/export/route.ts ──────────────────────────
// GET  ?format=csv   → streamed CSV download (server)
// PDF generation is handled client-side via jspdf in InvitesSection
// to avoid pdfkit/fontkit Turbopack ESM incompatibility.

import { withProfile } from '@/lib/supabase/with-profile'
import { fetchEventShares } from '@/lib/server/event-shares'
import { NextRequest } from 'next/server'

function toISODate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toISOString().split('T')[0]
}

function toLocalDateTime(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { timeZone: 'Europe/Sofia' })
}

export async function GET(req: NextRequest): Promise<Response> {
  const ctx = await withProfile<{ id: string; first_name: string; last_name: string }>('id, first_name, last_name')
  if (ctx.response) return ctx.response
  const { supabase, profile } = ctx

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const eventId = searchParams.get('event_id')
  const status  = searchParams.get('status')
  const method  = searchParams.get('method')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const q       = searchParams.get('q')

  const { data: filtered, error } = await fetchEventShares(supabase, profile.id, {
    eventId, status, method, from, to, q,
  })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // ── CSV ────────────────────────────────────────────────────────────────────
  const rows: string[] = [
    ['Event Title', 'Event Date', 'Share Method', 'Shared At', 'Clicks',
     'Guest Name', 'Guest Email', 'Status', 'Attended'].join(','),
  ]

  for (const link of filtered ?? []) {
    const ev        = link.event
    const eventTitle = `"${(ev?.title ?? '').replace(/"/g, '""')}"`
    const eventDate  = toISODate(ev?.start_time ?? null)
    const sharedAt   = toLocalDateTime(link.created_at)

    if (link.guests.length === 0) {
      rows.push([
        eventTitle, eventDate, link.share_method, `"${sharedAt}"`,
        String(link.click_count), '', '', '', '',
      ].join(','))
    } else {
      for (const g of link.guests) {
        const gStatus    = g.attended_at ? 'attended' : g.status
        const attendedAt = g.attended_at ? toLocalDateTime(g.attended_at) : ''
        rows.push([
          eventTitle, eventDate, link.share_method, `"${sharedAt}"`,
          String(link.click_count),
          `"${g.name.replace(/"/g, '""')}"`,
          `"${g.email.replace(/"/g, '""')}"`,
          gStatus,
          `"${attendedAt}"`,
        ].join(','))
      }
    }
  }

  const filename = `share-history-${toISODate(new Date().toISOString())}.csv`
  return new Response(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
