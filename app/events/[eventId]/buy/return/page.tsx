import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import QRCode from 'qrcode'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe, isStripeConfigured } from '@/lib/server/stripe/client'
import { fulfillOrder, type FulfilResult } from '@/lib/server/tickets/fulfill'
import { sendPassEmail } from '@/lib/server/tickets/pass-email'
import { getSale, isDoorOpen } from '@/lib/server/tickets/sales'
import { formatDate } from '@/lib/format'
import { t } from '@/lib/i18n'
import { getLangFromCookies } from '@/lib/utils/lang-cookie'
import { BuyShell } from '../components/BuyShell'

// The session id in this URL shows the pass: keep it out of other sites' logs.
export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false } }

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<{ session_id?: string }> }

async function load(sessionId: string | undefined): Promise<FulfilResult | { status: 'error' }> {
  if (!isStripeConfigured() || sessionId === undefined || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    return { status: 'not_found' }
  }
  const supabase = createServiceClient()
  try {
    return await fulfillOrder({ supabase, stripe: getStripe(), sendEmail: (id) => sendPassEmail(supabase, id) }, sessionId)
  } catch (err) {
    console.error('[buy/return]', err instanceof Error ? err.name : 'error')
    return { status: 'error' }
  }
}

export default async function BuyReturnPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { session_id } = await searchParams
  const [lang, result] = await Promise.all([getLangFromCookies(), load(session_id)])
  const brand = t('event.join.brandName', lang)

  if (result.status !== 'fulfilled') {
    const pending = result.status === 'error' || result.status === 'mismatch'
    return (
      <BuyShell brand={brand} title={t(pending ? 'tickets.return.pendingTitle' : 'tickets.return.unpaidTitle', lang)}>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          {t(pending ? 'tickets.return.pending' : 'tickets.return.unpaid', lang)}
        </p>
        {!pending && (
          <Link href={`/events/${eventId}/buy`} className="text-sm font-semibold underline" style={{ color: 'var(--text-primary)' }}>
            {t('tickets.return.back', lang)}
          </Link>
        )}
      </BuyShell>
    )
  }

  const { pass } = result
  const sale = result.eventId === null ? null : await getSale(createServiceClient(), result.eventId)
  const canJoin = sale !== null && !result.doorAdmitted && pass.status === 'active'
    && sale.event.tickets_cancelled_at === null && !sale.onlineOver && isDoorOpen(sale.event)
  const qr = await QRCode.toDataURL(pass.qr_token, { width: 480, margin: 2 })

  return (
    <BuyShell brand={brand} title={t('tickets.return.title', lang)}>
      <div className="space-y-4">
        {pass.status === 'void' && (
          <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.return.void', lang)}</p>
        )}
        {result.doorAdmitted && <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tickets.return.doorIn', lang)}</p>}
        {result.doorError !== null && (
          <p className="text-sm" role="alert" style={{ color: 'var(--status-alert-fg)' }}>{t('tickets.return.doorFailed', lang)}</p>
        )}
        {canJoin && (
          <Link href={`/events/${result.eventId}/join`}
            className="block w-full text-center px-6 py-3 rounded-xl text-sm font-semibold text-on-accent"
            style={{ backgroundColor: 'var(--brand-crimson)' }}>
            {t('tickets.return.join', lang)}
          </Link>
        )}
        <p className="font-mono text-2xl font-semibold tracking-widest text-center" style={{ color: 'var(--text-primary)' }}>{pass.unlock_code}</p>
        <Image src={qr} alt={t('tickets.return.qrAlt', lang)} width={240} height={240} unoptimized className="mx-auto" />
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.tickets.comp.entries', lang)}: {pass.entries_total} · {t('admin.tickets.comp.expires', lang)}: {formatDate(pass.expires_at)}
        </p>
        <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>{t('tickets.return.emailed', lang)}</p>
      </div>
    </BuyShell>
  )
}
