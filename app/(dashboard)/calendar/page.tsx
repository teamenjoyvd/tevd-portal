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
  let resolvedRole: 'admin' | 'core' | 'member' | 'guest' = 'guest'
  let userRole: 'admin' | 'core' | 'member' | 'guest' | null = null
  let userProfileId: string | null = null
  let profileNameMissing = false

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name, display_names')
      .eq('clerk_id', userId)
      .single()

    if (profile) {
      resolvedRole  = profile.role
      userRole      = profile.role
      userProfileId = profile.id

      // display_names is JSONB — cast to known shape.
      // BG name fields are stored as bg_first / bg_last (see PersonalDetailsContent).
      const dn = profile.display_names as Record<string, string> | null
      const hasName =
        !!profile.first_name ||
        !!profile.last_name ||
        !!(dn?.bg_first) ||
        !!(dn?.bg_last)
      profileNameMissing = !hasName
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
      profileNameMissing={profileNameMissing}
    />
  )
}
