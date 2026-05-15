'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { PaymentsTab } from './components/PaymentsTab'
import type { Trip } from '@/lib/types/trips'
import type { MembersResponse } from './components/operations-types'

// ── Constants ─────────────────────────────────────────────────────

const TABS = [
  { key: 'payments', label: 'Payments' },
] as const
type TabKey = typeof TABS[number]['key']

// ── Main page ─────────────────────────────────────────────────────

function OperationsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'payments') as TabKey

  // trips query retained: PaymentsTab log-payment dropdown consumer
  const { data: trips = [] } = useQuery<Trip[]>({
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
