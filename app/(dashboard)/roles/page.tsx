import { Suspense } from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import RolesClient from './components/RolesClient'
import { getQuarterEvents, getHistoryEvents, getLeaderboard } from '@/lib/roles/queries'
import { RoleEvent } from '@/lib/roles/types'
import { Database } from '@/types/supabase'

const ROLE_RANK: Record<string, number> = { guest: 0, member: 1, core: 2, admin: 3 }
const HISTORY_LIMIT = 15

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    quarter?: string
    year?: string
    page?: string
    search?: string
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
  const tab = params.tab || 'quarter'
  const now = new Date()
  const currentYear = now.getUTCFullYear()
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1

  const year = parseInt(params.year || '') || currentYear
  const quarter = parseInt(params.quarter || '') || currentQuarter
  const page = parseInt(params.page || '') || 1
  const search = params.search || ''

  // Conditional RSC Fetching based on the active tab
  let quarterEvents: RoleEvent[] = []
  let historyData: { events: RoleEvent[]; count: number } = { events: [], count: 0 }
  let leaderboardData: Database['public']['Views']['member_roles_leaderboard']['Row'][] = []

  if (tab === 'quarter') {
    quarterEvents = await getQuarterEvents(supabase, year, quarter)
  } else if (tab === 'history') {
    historyData = await getHistoryEvents(supabase, page, HISTORY_LIMIT, search)
  } else if (tab === 'leaderboard') {
    leaderboardData = await getLeaderboard(supabase)
  }

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
        historyEvents={historyData.events}
        historyCount={historyData.count}
        historyPage={page}
        historyLimit={HISTORY_LIMIT}
        historySearch={search}
        leaderboardData={leaderboardData}
      />
    </Suspense>
  )
}
