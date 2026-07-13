'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '@/lib/utils/fetchJson'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { TripRegistrationsTab } from './components/TripRegistrationsTab'
import { AboVerificationTab } from './components/VerificationsTab'
import { EventRolesTab } from './components/EventRolesTab'
import { SpouseLinkRequestsTab } from './components/SpouseLinkRequestsTab'
import { LosSubmissionsTab, type LosSubmission } from './components/LosSubmissionsTab'
import type { TripRegistration } from './components/TripRegistrationsTab'
import type { SpouseLinkRequest } from './components/SpouseLinkRequestsTab'

// ── Inner page (needs useSearchParams) ────────────────────────────────────

function ApprovalHubInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'trips') as 'trips' | 'roles' | 'abo' | 'spouse' | 'los'

  const { data: registrations = [] } = useQuery<TripRegistration[]>({
    queryKey: ['registrations', 'all'],
    queryFn: () => fetchJson<TripRegistration[]>('/api/admin/registrations'),
  })

  // Fetch role requests from the dedicated admin endpoint — same query key used by EventRolesTab
  // so this is a cache hit when the tab renders, not a second network request.
  const { data: roleRequests = [] } = useQuery<{ id: string; status: string }[]>({
    queryKey: ['role-requests', 'all'],
    queryFn: () => fetchJson<{ id: string; status: string }[]>('/api/admin/event-role-requests'),
  })

  const { data: spouseRequests = [] } = useQuery<SpouseLinkRequest[]>({
    queryKey: ['spouse-link-requests'],
    queryFn: () => fetchJson<SpouseLinkRequest[]>('/api/admin/spouse-link-requests'),
  })

  const { data: losSubmissions = [] } = useQuery<LosSubmission[]>({
    queryKey: ['los-submissions'],
    queryFn: async () => (await fetchJson<{ submissions: LosSubmission[] }>('/api/admin/los-submission')).submissions,
  })

  const pendingTrips  = registrations.filter(r => r.status === 'pending').length
  const pendingRoles  = roleRequests.filter(r => r.status === 'pending').length
  const pendingSpouse = spouseRequests.filter(r => r.status === 'pending').length
  const pendingLos    = losSubmissions.filter(r => r.status === 'pending').length

  const tabsWithBadges = [
    { key: 'trips',  label: 'Trip Registrations',   badge: pendingTrips  },
    { key: 'roles',  label: 'Event Roles',           badge: pendingRoles  },
    { key: 'abo',    label: 'ABO Verification',      badge: 0             },
    { key: 'spouse', label: 'Co-ownership Requests', badge: pendingSpouse },
    { key: 'los',    label: 'LOS Submissions',       badge: pendingLos    },
  ]

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Approval Hub
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Review and action pending requests from members.
      </p>

      <AdminTabs
        tabs={tabsWithBadges}
        value={tab}
        onValueChange={val => router.replace(`?tab=${val}`, { scroll: false })}
      >
        <TabsContent value="trips"><TripRegistrationsTab /></TabsContent>
        <TabsContent value="roles"><EventRolesTab /></TabsContent>
        <TabsContent value="abo"><AboVerificationTab /></TabsContent>
        <TabsContent value="spouse"><SpouseLinkRequestsTab /></TabsContent>
        <TabsContent value="los"><LosSubmissionsTab /></TabsContent>
      </AdminTabs>
    </div>
  )
}

export default function ApprovalHubPage() {
  return (
    <Suspense>
      <ApprovalHubInner />
    </Suspense>
  )
}
