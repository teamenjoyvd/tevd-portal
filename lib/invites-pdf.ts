// ── lib/invites-pdf.ts ─────────────────────────────────────────────────────
// Client-side PDF generation for the InvitesSection export.
// Runs entirely in the browser — avoids all server-side PDF library
// incompatibilities (pdfkit/fontkit break under Turbopack).
// Imported dynamically in InvitesSection to keep it out of the main bundle.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number }
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type GuestRow = {
  id: string
  name: string
  email: string
  status: string
  attended_at: string | null
  created_at: string
}

type ShareLink = {
  id: string
  share_method: 'native' | 'clipboard'
  click_count: number
  created_at: string
  event: { id: string; title: string; start_time: string }
  guests: GuestRow[]
}

export function generateInvitesPdf(links: ShareLink[], memberName: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const brand: [number, number, number] = [26, 60, 46]   // #1a3c2e
  const muted: [number, number, number] = [107, 114, 128] // #6b7280
  const pageW = doc.internal.pageSize.getWidth()

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...brand)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Share Link History', pageW / 2, 11, { align: 'center' })

  doc.setTextColor(...muted)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${memberName} · Exported ${new Date().toLocaleDateString('en-GB')}`,
    pageW / 2, 22, { align: 'center' },
  )

  let y = 28

  for (const link of links) {
    const guests   = link.guests
    const attended = guests.filter(g => g.attended_at).length
    const confirmed = guests.filter(g => g.status === 'confirmed' || g.attended_at).length

    // ── Event block header ─────────────────────────────────────────────────
    if (y > 260) { doc.addPage(); y = 15 }

    doc.setTextColor(...brand)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(link.event.title, 14, y)
    y += 5

    doc.setTextColor(...muted)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${fmt(link.event.start_time)} · Shared ${fmtDateTime(link.created_at)} via ${link.share_method}`,
      14, y,
    )
    y += 4
    doc.text(
      `Clicks: ${link.click_count}  ·  Registrations: ${guests.length}  ·  Confirmed: ${confirmed}  ·  Attended: ${attended}`,
      14, y,
    )
    y += 4

    // ── Guest table ────────────────────────────────────────────────────────
    if (guests.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: 14, right: 14 },
        head: [['Name', 'Email', 'Status', 'Registered', 'Attended']],
        body: guests.map(g => [
          g.name,
          g.email,
          g.attended_at ? 'attended' : g.status,
          fmt(g.created_at),
          fmt(g.attended_at),
        ]),
        headStyles: {
          fillColor: brand,
          fontSize: 7,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: { fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 22 },
          3: { cellWidth: 28 },
          4: { cellWidth: 28 },
        },
      })
      y = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 6
    } else {
      doc.setTextColor(...muted)
      doc.setFontSize(7.5)
      doc.text('No registrations through this link.', 14, y)
      y += 8
    }

    // Separator line
    doc.setDrawColor(229, 231, 235)
    doc.line(14, y, pageW - 14, y)
    y += 6
  }

  const filename = `share-history-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
