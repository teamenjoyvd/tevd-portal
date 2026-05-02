import TripsClient from './TripsClient'
import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

type Trip = {
  id: string
  title: string
  destination: string
  description: string
  image_url: string | null
  start_date: string
  end_date: string
  currency: 'EUR'
  total_cost: number
  milestones: unknown[]
  access_roles: string[]
  location: string | null
  accommodation_type: string | null
  inclusions: string[]
  trip_type: string | null
}

export type { Trip }

export default async function TripsPage() {
  // Resolve role server-side so we can prefetch the correct trip list.
  // Unauthenticated visitors get guest-filtered trips with zero client round trips.
  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const supabase = createServiceClient()
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated */ }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('trips')
    .select('*')
    .contains('access_roles', [role])
    .order('start_date')

  const initialTrips = (data ?? []) as Trip[]

  return <TripsClient initialTrips={initialTrips} />
}
