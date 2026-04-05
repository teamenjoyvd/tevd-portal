'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { TripsTab } from './components/TripsTab'
import { ItemsTab } from './components/ItemsTab'
import { PaymentsTab } from './components/PaymentsTab'
import type { Trip } from './components/TripsTab'
import type { MembersResponse } from './components/PaymentsTab'

// ── Constants ────────────────────────────────────────────────────

const TABS = [
  { key: 'trips',    label: 'Trips'    },
  { key: 'items',    label: 'Items'    },
  { key: 'payments', label: 'Payments' },
] as const
type TabKey = typeof TABS[number]['key']

// ── Main page ─────────────────────────────────────────────────────

function OperationsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'trips') as TabKey

  const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Operations
        </h1>
      </div>

      <AdminTabs
        tabs={[...TABS]}
        value={tab}
        onValueChange={val => router.replace(`?tab=${val}`, { scroll: false })}
      >
        <TabsContent value="trips"><TripsTab trips={trips} isLoading={tripsLoading} /></TabsContent>
        <TabsContent value="items"><ItemsTab trips={trips} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab trips={trips} membersData={membersData} /></TabsContent>
      </AdminTabs>
    </div>
  )
}

export default function OperationsPage() {
  return (
    <Suspense>
      <OperationsInner />
    </Suspense>
  )
}
