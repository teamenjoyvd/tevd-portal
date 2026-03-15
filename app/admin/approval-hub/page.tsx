'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────────

type Trip = { id: string; title: string; destination: string; start_date: string }

type TripRegistration = {
  id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  trip_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type CalendarEvent = { id: string; title: string; start_time: string }

type RoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
  created_at: string
  event_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#f2cc8f]/30 text-[#7a5c00] border border-[#f2cc8f]',
  approved: 'bg-[#81b29a]/20 text-[#2d6a4f] border border-[#81b29a]/50',
  denied:   'bg-[#bc4749]/10 text-[#bc4749] border border-[#bc4749]/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function CollapsibleResolved({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-3 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--stone)' }}
      >
        <span>Resolved — {count}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}

// ── Trip Registrations Tab ─────────────────────────────────────────────────

function TripRegistrationsTab() {
  const qc = useQueryClient()
  const [filterTripId, setFilterTripId] = useState<string>('all')

  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
  })

  const { data: registrations = [], isLoading } = useQuery<TripRegistration[]>({
    queryKey: ['registrations', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        trips.map(t => fetch(`/api/trips/${t.id}/registrations`).then(r => r.json()))
      )
      return results.flat()
    },
    enabled: trips.length > 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['registrations', 'all'] })
      const prev = qc.getQueryData<TripRegistration[]>(['registrations', 'all'])
      qc.setQueryData<TripRegistration[]>(['registrations', 'all'], old =>
        old?.map(r => r.id === id ? { ...r, status } : r)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['registrations', 'all'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['registrations', 'all'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const filtered = filterTripId === 'all'
    ? registrations
    : registrations.filter(r => r.trip_id === filterTripId)

  const pending  = filtered.filter(r => r.status === 'pending')
  const resolved = filtered.filter(r => r.status !== 'pending')
  const tripTitle = (id: string) => trips.find(t => t.id === id)?.title ?? id

  return (
    <div>
      {/* Filter */}
      {trips.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterTripId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterTripId === 'all' ? 'var(--deep)' : 'rgba(0,0,0,0.05)',
              color: filterTripId === 'all' ? 'white' : 'var(--stone)',
            }}
          >
            All trips
          </button>
          {trips.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTripId(t.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: filterTripId === t.id ? 'var(--deep)' : 'rgba(0,0,0,0.05)',
                color: filterTripId === t.id ? 'white' : 'var(--stone)',
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Pending */}
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--stone)' }}>
        Pending — {pending.length}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-black/5 bg-white px-5 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--stone)' }}>No pending registrations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 px-4 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                  {r.profile.first_name} {r.profile.last_name}
                  {r.profile.abo_number && (
                    <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--stone)' }}>
                      {r.profile.abo_number}
                    </span>
                  )}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                  {tripTitle(r.trip_id)} · {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--sage)' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--deep)' }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved (collapsible) */}
      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-black/5 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--deep)' }}>
                {r.profile.first_name} {r.profile.last_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                {tripTitle(r.trip_id)}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
      </CollapsibleResolved>
    </div>
  )
}

// ── Event Roles Tab ────────────────────────────────────────────────────────

function EventRolesTab() {
  const qc = useQueryClient()
  const [filterEventId, setFilterEventId] = useState<string>('all')

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events-list'],
    queryFn: () => fetch('/api/calendar').then(r => r.json()),
  })

  const { data: roleRequests = [], isLoading } = useQuery<RoleRequest[]>({
    queryKey: ['role-requests', 'all'],
    queryFn: async () => {
      const results = await Promise.all(
        events.map(e => fetch(`/api/events/${e.id}`).then(r => r.json()))
      )
      return results.flatMap(e => (e.role_requests ?? []).map((rr: RoleRequest) => ({
        ...rr,
        event_id: e.id,
      })))
    },
    enabled: events.length > 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/event-role-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['role-requests', 'all'] })
      const prev = qc.getQueryData<RoleRequest[]>(['role-requests', 'all'])
      qc.setQueryData<RoleRequest[]>(['role-requests', 'all'], old =>
        old?.map(r => r.id === id ? { ...r, status } : r)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['role-requests', 'all'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['role-requests', 'all'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const eventsWithRequests = events.filter(e =>
    roleRequests.some(r => r.event_id === e.id)
  )

  const filtered = filterEventId === 'all'
    ? roleRequests
    : roleRequests.filter(r => r.event_id === filterEventId)

  const pending  = filtered.filter(r => r.status === 'pending')
  const resolved = filtered.filter(r => r.status !== 'pending')
  const eventTitle = (id: string) => events.find(e => e.id === id)?.title ?? id

  return (
    <div>
      {/* Filter — only events that have requests */}
      {eventsWithRequests.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterEventId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterEventId === 'all' ? 'var(--deep)' : 'rgba(0,0,0,0.05)',
              color: filterEventId === 'all' ? 'white' : 'var(--stone)',
            }}
          >
            All events
          </button>
          {eventsWithRequests.map(e => (
            <button
              key={e.id}
              onClick={() => setFilterEventId(e.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors max-w-[160px] truncate"
              style={{
                backgroundColor: filterEventId === e.id ? 'var(--deep)' : 'rgba(0,0,0,0.05)',
                color: filterEventId === e.id ? 'white' : 'var(--stone)',
              }}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      {/* Pending */}
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--stone)' }}>
        Pending — {pending.length}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-black/5 bg-white px-5 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--stone)' }}>No pending role requests.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-black/5 px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {r.profile.first_name} {r.profile.last_name}
                    {r.profile.abo_number && (
                      <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--stone)' }}>
                        {r.profile.abo_number}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    <span className="font-medium" style={{ color: 'var(--deep)' }}>{r.role_label}</span>
                    {' · '}{eventTitle(r.event_id)}
                  </p>
                  {r.note && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--stone)' }}>
                      "{r.note}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                    disabled={updateMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--sage)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                    disabled={updateMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--deep)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolved (collapsible) */}
      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-black/5 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--deep)' }}>
                {r.profile.first_name} {r.profile.last_name}
                {' · '}
                <span className="font-medium">{r.role_label}</span>
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--stone)' }}>
                {eventTitle(r.event_id)}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
      </CollapsibleResolved>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ApprovalHubPage() {
  const [activeTab, setActiveTab] = useState<'trips' | 'roles'>('trips')

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
      return results.flat()
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

  const pendingTrips = registrations.filter(r => r.status === 'pending').length
  const pendingRoles = roleRequests.filter(r => r.status === 'pending').length

  const tabs = [
    { key: 'trips' as const, label: 'Trip Registrations', count: pendingTrips },
    { key: 'roles' as const, label: 'Event Roles',         count: pendingRoles },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-serif text-2xl font-semibold mb-1" style={{ color: 'var(--deep)' }}>
        Approval Hub
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--stone)' }}>
        Review and action pending requests from members.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? 'var(--deep)' : 'var(--stone)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                style={{ backgroundColor: 'var(--crimson)', color: 'white' }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'trips' ? <TripRegistrationsTab /> : <EventRolesTab />}
    </div>
  )
}