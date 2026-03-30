import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import CalendarClient from '@/components/calendar/CalendarClient'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
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

  let query = supabase
    .from('calendar_events')
    .select('*')
    .gte('start_time', start)
    .lt('start_time', end)
    .order('start_time')

  if (!userId) {
    query = query.eq('category', 'N21')
  }

  const { data: initialEvents } = await query

  let userRole: 'admin' | 'core' | 'member' | 'guest' | null = null
  let userProfileId: string | null = null

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', userId)
      .single()

    userRole = (profile?.role ?? 'member') as 'admin' | 'core' | 'member' | 'guest'
    userProfileId = profile?.id ?? null
  }

  return (
    <Suspense>
      <CalendarClient
        initialEvents={initialEvents ?? []}
        initialMonth={month}
        userRole={userRole}
        userProfileId={userProfileId}
        isAuthenticated={!!userId}
      />
    </Suspense>
  )
}
