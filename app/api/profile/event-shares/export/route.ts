// ── app/api/profile/event-shares/export/route.ts ─────────────────────────
// GET — export share link history as CSV or PDF
// Supports same filter params as GET /api/profile/event-shares
// Auth-scoped to caller's own links only.

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
  const format  = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'
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

  const memberName = `${profile.first_name} ${profile.last_name}`.trim()

  // ── CSV ───────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const rows: string[] = [
      ['Event Title', 'Event Date', 'Share Method', 'Shared At', 'Clicks', 'Guest Name', 'Guest Email', 'Status', 'Attended'].join(','),
    ]

    for (const link of filtered) {
      const ev = link.event as any
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
          const gStatus   = g.attended_at ? 'attended' : g.status
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

  // ── PDF ───────────────────────────────────────────────────────────────
  // Uses pdfkit (server-side, no browser API needed).
  // NOTE: pdfkit must be added to package.json before this route is used.
  const PDFDocument = (await import('pdfkit')).default
  const { Readable } = await import('stream')

  const doc = new PDFDocument({ margin: 40, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('Share Link History', { align: 'center' })
  doc.fontSize(10).font('Helvetica').fillColor('#6b7280')
    .text(`${memberName} · Exported ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' })
  doc.moveDown(1.5)

  for (const link of filtered) {
    const ev      = link.event as any
    const guests  = link.guests as any[]
    const clicks  = link.click_count
    const regs    = guests.length
    const attended = guests.filter(g => g.attended_at).length

    // Event header
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a3c2e')
      .text(ev?.title ?? 'Untitled Event')
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
      .text(`${toISODate(ev?.start_time ?? null)} · Shared ${toLocalDateTime(link.created_at)} via ${link.share_method}`)
    doc.fontSize(9).fillColor('#374151')
      .text(`Clicks: ${clicks}  Registrations: ${regs}  Attended: ${attended}`)
    doc.moveDown(0.5)

    if (guests.length > 0) {
      // Column headers
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#111827')
      const y0 = doc.y
      doc.text('Name',       40,  y0, { width: 140 })
      doc.text('Email',      190, y0, { width: 170 })
      doc.text('Status',     370, y0, { width: 80 })
      doc.text('Attended',   460, y0, { width: 90 })
      doc.moveDown(0.3)
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').stroke()
      doc.moveDown(0.2)

      for (const g of guests) {
        const gStatus    = g.attended_at ? 'attended' : g.status
        const attendedAt = g.attended_at ? toISODate(g.attended_at) : '—'
        doc.fontSize(8).font('Helvetica').fillColor('#374151')
        const y = doc.y
        doc.text(g.name,      40,  y, { width: 140 })
        doc.text(g.email,     190, y, { width: 170 })
        doc.text(gStatus,     370, y, { width: 80  })
        doc.text(attendedAt,  460, y, { width: 90  })
        doc.moveDown(0.3)
      }
    } else {
      doc.fontSize(8).font('Helvetica').fillColor('#9ca3af').text('No registrations through this link.')
    }

    doc.moveDown(1.5)
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').stroke()
    doc.moveDown(1)
  }

  doc.end()

  await new Promise<void>(resolve => doc.on('end', resolve))
  const pdfBuffer = Buffer.concat(chunks)
  const filename  = `share-history-${toISODate(new Date().toISOString())}.pdf`

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
