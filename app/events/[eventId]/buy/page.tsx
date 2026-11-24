import { notFound } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPublishableKey, isStripeConfigured } from '@/lib/server/stripe/client'
import { getSale, isDoorOpen, isRoomFull } from '@/lib/server/tickets/sales'
import { formatDateTime } from '@/lib/format'
import { t } from '@/lib/i18n'
import { getLangFromCookies } from '@/lib/utils/lang-cookie'
import { BuyForm } from './components/BuyForm'
import { BuyShell } from './components/BuyShell'

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<{ door?: string }> }

const UUID = /^[0-9a-f-]{36}$/i

export default async function BuyPage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { door: doorParam } = await searchParams
  if (!UUID.test(eventId)) notFound()

  const supabase = createServiceClient()
  const [lang, sale, user] = await Promise.all([getLangFromCookies(), getSale(supabase, eventId), currentUser()])
  if (sale === null) notFound()
  const { event, products } = sale

  const door = doorParam === '1'
  const publishableKey = isStripeConfigured() ? getPublishableKey() : null
  const blocked =
    !sale.salesOpen || publishableKey === null ? 'tickets.buy.closed'
    : door && !isDoorOpen(event) ? 'tickets.buy.doorClosed'
    : door && (await isRoomFull(supabase, event)) ? 'tickets.buy.full'
    : null

  return (
    <BuyShell brand={t('event.join.brandName', lang)} title={event.title} subtitle={formatDateTime(event.start_time)}>
      {blocked !== null || publishableKey === null ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t(blocked ?? 'tickets.buy.closed', lang)}</p>
      ) : (
        <BuyForm
          eventId={event.id}
          door={door}
          lang={lang}
          onlineOver={sale.onlineOver}
          products={products.map((p) => ({
            id: p.id,
            kind: p.kind === 'pack' ? 'pack' : 'single',
            priceCents: p.price_cents,
            entries: p.entries,
            validityDays: p.validity_days,
          }))}
          initialName={[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
          initialEmail={user?.primaryEmailAddress?.emailAddress ?? ''}
          publishableKey={publishableKey}
        />
      )}
    </BuyShell>
  )
}
