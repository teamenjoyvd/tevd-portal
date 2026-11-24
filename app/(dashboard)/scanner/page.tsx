import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { getCallerContext } from '@/lib/supabase/guards'
import { todaysDoorEvents } from '@/lib/server/tickets/door'
import { ScannerClient } from './components/ScannerClient'

export const dynamic = 'force-dynamic'

/** Not under /admin: that layout lets admins in only, and core staff work the door. */
export default async function ScannerPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const supabase = createServiceClient()
  const ctx = await getCallerContext(userId, supabase, 'adminOrCore')
  if (ctx.guard) redirect('/')
  return <ScannerClient events={await todaysDoorEvents(supabase)} />
}
