import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import RolesClient from './components/RolesClient'
import { getQuarterEvents, getEventYears, getParticipationHistory } from '@/lib/roles/queries'

const ROLE_RANK: Record<string, number> = { guest: 0, member: 1, core: 2, admin: 3 }

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    quarter?: string
    q?: string
    year?: string
    view?: string
  }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/calendar')

  const supabase = createServiceClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_id', userId)
    .single()

  if (!callerProfile || (ROLE_RANK[callerProfile.role] ?? -1) < ROLE_RANK.core) {
    redirect('/calendar')
  }

  // Parse parameters
  const params = await searchParams
  const tab: 'quarter' | 'history' = params.tab === 'leaderboard' || params.tab === 'history' || params.view === 'history' ? 'history' : 'quarter'
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1

  const yearMatch = (params.year || '').match(/\d+/)
  const year = yearMatch ? parseInt(yearMatch[0], 10) : currentYear
  const quarterMatch = (params.quarter || params.q || '').match(/\d+/)
  const quarter = quarterMatch ? parseInt(quarterMatch[0], 10) : currentQuarter

  // Conditional RSC Fetching based on the active tab with safe defaults
  const quarterEvents = tab !== 'history'
    ? await getQuarterEvents(supabase, year, quarter)
    : []

  const participationHistoryData = tab === 'history'
    ? await getParticipationHistory(supabase)
    : []

  const eventYears = tab !== 'history'
    ? await getEventYears(supabase)
    : []

  return (
    <Suspense>
      <RolesClient
        tab={tab}
        selectedYear={year}
        selectedQuarter={quarter}
        currentYear={currentYear}
        currentQuarter={currentQuarter}
        currentTime={now.toISOString()}
        quarterEvents={quarterEvents}
        participationHistoryData={participationHistoryData}
        eventYears={eventYears}
      />
    </Suspense>
  )
}
