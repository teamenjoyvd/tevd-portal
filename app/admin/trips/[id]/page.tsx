import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TripFilesSection } from './components/TripFilesSection'
import { TripMessagesSection } from './components/TripMessagesSection'
import { TripHeroSection } from './components/TripHeroSection'
import { TripMetaForm } from './components/TripMetaForm'
import { MilestonesSection } from './components/MilestonesSection'
import { AccessRolesSection } from './components/AccessRolesSection'
import type { Trip } from '@/lib/types/trips'

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
    .select('*')
    .eq('id', tripId)
    .single()

  if (!trip) redirect('/admin/trips')

  const typedTrip = trip as unknown as Trip

  return (
    <div className="space-y-6 pb-16">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/trips"
          className="text-sm hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Trips
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
        {/* Left column */}
        <div className="space-y-6">
          <TripMetaForm trip={typedTrip} />
          <MilestonesSection tripId={tripId} initialMilestones={typedTrip.milestones ?? []} />
          <AccessRolesSection tripId={tripId} initialRoles={typedTrip.access_roles ?? []} />
        </div>
        {/* Right column */}
        <div className="space-y-6">
          <TripHeroSection tripId={tripId} initialImageUrl={trip.image_url ?? null} />
          <TripFilesSection tripId={tripId} />
          <TripMessagesSection tripId={tripId} />
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="md:hidden flex flex-col gap-6">
        <TripHeroSection tripId={tripId} initialImageUrl={trip.image_url ?? null} />
        <TripMetaForm trip={typedTrip} />
        <MilestonesSection tripId={tripId} initialMilestones={typedTrip.milestones ?? []} />
        <AccessRolesSection tripId={tripId} initialRoles={typedTrip.access_roles ?? []} />
        <TripFilesSection tripId={tripId} />
        <TripMessagesSection tripId={tripId} />
      </div>
    </div>
  )
}
