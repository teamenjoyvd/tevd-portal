import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import CalendarClient from './components/CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const { event: initialEventId = null } = await searchParams

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const start = new Date(`${month}-01`).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  let userId: string | null = null
  try {
    const session = await auth()
    userId = session.userId
  } catch {
    userId = null
  }

  const supabase = createServiceClient()

  // Resolve the role for access_roles filtering.
  // Unauthenticated and authenticated-but-no-profile both resolve to 'guest'.
  let resolvedRole: string = 'guest'
  let userRole: 'admin' | 'core' | 'member' | 'guest' | null = null
  let userProfileId: string | null = null

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', userId)
      .single()

    if (profile) {
      resolvedRole  = profile.role
      userRole      = profile.role as 'admin' | 'core' | 'member' | 'guest'
      userProfileId = profile.id
    }
    // no profile found: resolvedRole stays 'guest', userRole stays null
  }

  const { data: initialEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('start_time', start)
    .lt('start_time', end)
    .contains('access_roles', [resolvedRole])
    .order('start_time')

  return (
    <CalendarClient
      initialEvents={initialEvents ?? []}
      initialMonth={month}
      initialEventId={initialEventId}
      userRole={userRole}
      userProfileId={userProfileId}
      isAuthenticated={!!userId}
    />
  )
}
