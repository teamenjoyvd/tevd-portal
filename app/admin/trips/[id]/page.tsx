import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TripFilesSection } from './components/TripFilesSection'
import { TripMessagesSection } from './components/TripMessagesSection'

export const dynamic = 'force-dynamic'

export default async function TripManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: tripId } = await params

  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  const { data: trip } = await supabase
    .from('trips')
    .select('title')
    .eq('id', tripId)
    .single()

  if (!trip) redirect('/admin/operations?tab=trips')

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/operations?tab=trips"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Operations
        </Link>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <h1
          className="font-display text-2xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          {trip.title}
        </h1>
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden md:grid md:grid-cols-2 gap-6">
        <TripFilesSection tripId={tripId} />
        <TripMessagesSection tripId={tripId} />
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col gap-6">
        <TripFilesSection tripId={tripId} />
        <TripMessagesSection tripId={tripId} />
      </div>
    </div>
  )
}
