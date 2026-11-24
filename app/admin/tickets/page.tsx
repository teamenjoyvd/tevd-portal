import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { TicketsClient } from './components/TicketsClient'

export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('clerk_id', userId).single()
  if (!profile || profile.role !== 'admin') redirect('/')

  // A free-registration product needs no pass issued by hand.
  const { data, error } = await supabase
    .from('ticket_products')
    .select('id, kind, series_key, entries, calendar_events(title)')
    .eq('active', true)
    .neq('kind', 'free_registration')
    .order('price_cents')
  if (error) console.error('[TicketsPage] products query error:', error.code)

  return (
    <div className="space-y-6 pb-16">
      <TicketsClient
        loadFailed={error !== null}
        products={(data ?? []).map((p) => ({
          id: p.id,
          kind: p.kind,
          seriesKey: p.series_key,
          eventTitle: p.calendar_events?.title ?? null,
          entries: p.entries,
        }))}
      />
    </div>
  )
}
