// ── app/api/profile/event-shares/export/route.ts ──────────────────────────
// GET  ?format=csv   → streamed CSV download (server)
// PDF generation is handled client-side via jspdf in InvitesSection
// to avoid pdfkit/fontkit Turbopack ESM incompatibility.

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
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
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('clerk_id', userId)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const eventId = searchParams.get('event_id')
  const status  = searchParams.get('status')
  const method  = searchParams.get('method')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')
  const q       = searchParams.get('q')

  let query = supabase
    .from('event_share_links')
    .select(`
      id,
      token,
      share_method,
      click_count,
      created_at,
      event:calendar_events ( id, title, start_time ),
      guests:guest_registrations (
        id, name, email, status, attended_at, created_at
      )
    `)
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })

  if (eventId) query = query.eq('event_id', eventId)
  if (method)  query = query.eq('share_method', method)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data: links, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Apply guest-level filters
  const filtered = (links ?? []).map(link => ({
    ...link,
    guests: (link.guests as any[]).filter(g => {
      const guestStatus = g.attended_at ? 'attended' : g.status
      const matchStatus = status ? guestStatus === status : true
      const matchQ      = q ? (g.name as string).toLowerCase().includes(q.toLowerCase()) : true
      return matchStatus && matchQ
    }),
  }))

  // ── CSV ────────────────────────────────────────────────────────────────────
  const rows: string[] = [
    ['Event Title', 'Event Date', 'Share Method', 'Shared At', 'Clicks',
     'Guest Name', 'Guest Email', 'Status', 'Attended'].join(','),
  ]

  for (const link of filtered) {
    const ev        = link.event as any
    const eventTitle = `"${(ev?.title ?? '').replace(/"/g, '""')}"`
    const eventDate  = toISODate(ev?.start_time ?? null)
    const sharedAt   = toLocalDateTime(link.created_at)

    if ((link.guests as any[]).length === 0) {
      rows.push([
        eventTitle, eventDate, link.share_method, `"${sharedAt}"`,
        String(link.click_count), '', '', '', '',
      ].join(','))
    } else {
      for (const g of link.guests as any[]) {
        const gStatus    = g.attended_at ? 'attended' : g.status
        const attendedAt = g.attended_at ? toLocalDateTime(g.attended_at) : ''
        rows.push([
          eventTitle, eventDate, link.share_method, `"${sharedAt}"`,
          String(link.click_count),
          `"${(g.name as string).replace(/"/g, '""')}"`,
          `"${(g.email as string).replace(/"/g, '""')}"`,
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
