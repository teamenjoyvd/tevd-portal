'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { useQuery } from '@tanstack/react-query'
import type { MyTicket } from '@/app/api/tickets/mine/route'
import { apiClient } from '@/lib/apiClient'
import { formatDate } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Skeleton } from '@/components/ui/skeleton'

export function MyTicketsClient() {
  const { t } = useLanguage()
  const { data, isPending, isError } = useQuery<MyTicket[]>({
    queryKey: ['my-tickets'],
    queryFn: () => apiClient('/api/tickets/mine'),
  })

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 space-y-4">
      <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tickets.mine.title')}</h1>
      {isPending && <Skeleton className="h-64 w-full rounded-2xl" />}
      {isError && <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.mine.error')}</p>}
      {data?.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tickets.mine.empty')}</p>}
      {data?.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
    </div>
  )
}

function TicketCard({ ticket }: { ticket: MyTicket }) {
  const { t } = useLanguage()
  const [qr, setQr] = useState<string | null>(null)
  const usable = !ticket.void && ticket.entries_left > 0

  useEffect(() => {
    if (!usable) return
    let current = true
    QRCode.toDataURL(ticket.qr_token, { width: 480, margin: 2 }).then(
      (url) => { if (current) setQr(url) },
      () => {},
    )
    return () => { current = false }
  }, [ticket.qr_token, usable])

  return (
    <section className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
      <p className="font-mono text-2xl font-semibold tracking-widest text-center" style={{ color: 'var(--text-primary)' }}>{ticket.code}</p>
      {ticket.void && <p className="text-sm text-center" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.return.void')}</p>}
      {usable && qr !== null && <Image src={qr} alt={t('tickets.return.qrAlt')} width={220} height={220} unoptimized className="mx-auto" />}
      <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
        {t('tickets.mine.left')}: {ticket.entries_left} / {ticket.entries_total} · {t('admin.tickets.comp.expires')}: {formatDate(ticket.expires_at)}
      </p>
      {ticket.history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('tickets.mine.history')}</p>
          {ticket.history.map((h) => (
            <p key={h.id} className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>
              {formatDate(h.start_time)} · {h.title} · {h.attendee} · {t(h.mode === 'online' ? 'tickets.mine.online' : 'tickets.mine.inPerson')}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
