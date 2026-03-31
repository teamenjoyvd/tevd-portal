'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { TripRegistrationsTab } from './components/PaymentsApprovalTab'
import { AboVerificationTab } from './components/VerificationsTab'
import { EventRolesTab } from './components/DirectVerifyTab'
import type { TripRegistration } from './components/PaymentsApprovalTab'
import type { AdminMembersResponse } from './components/VerificationsTab'

// ── Types ─────────────────────────────────────────────────────

type Trip = { id: string; title: string; destination: string; start_date: string }
type CalendarEvent = { id: string; title: string; start_time: string }
type RoleRequest = {
  id: string; role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null; created_at: string; event_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

// ── Inner page (needs useSearchParams) ────────────────────────────

function ApprovalHubInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'trips') as 'trips' | 'roles' | 'abo'

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [] } = useQuery<TripRegistration[]>({
    queryKey: ['registrations', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        trips.map(t => fetch(`/api/trips/${t.id}/registrations`).then(r => r.json()))
      )
      return results.flat().filter((r): r is TripRegistration => !r.error)
    },
    enabled: trips.length > 0,
  })

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events-list'],
    queryFn: () => fetch('/api/calendar').then(r => r.json()),
  })

  const { data: roleRequests = [] } = useQuery<RoleRequest[]>({
    queryKey: ['role-requests', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        events.map(e => fetch(`/api/events/${e.id}`).then(r => r.json()))
      )
      return results.flatMap(e => e.role_requests ?? [])
    },
    enabled: events.length > 0,
  })

  const { data: membersData } = useQuery<AdminMembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const pendingTrips = registrations.filter(r => r.status === 'pending').length
  const pendingRoles = roleRequests.filter(r => r.status === 'pending').length
  const pendingAbo   = (membersData?.pending_verifications ?? []).length

  const tabsWithBadges = [
    { key: 'trips', label: 'Trip Registrations', badge: pendingTrips },
    { key: 'roles', label: 'Event Roles',         badge: pendingRoles },
    { key: 'abo',   label: 'ABO Verification',    badge: pendingAbo   },
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
