'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'

// ── Types ──────────────────────────────────────────────────────────────────

type Trip = { id: string; title: string; destination: string; start_date: string }

type TripRegistration = {
  id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  trip_id: string
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null } | null
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

type VerificationRequest = {
  id: string
  profile_id: string
  claimed_abo: string | null
  claimed_upline_abo: string
  status: 'pending' | 'approved' | 'denied'
  request_type: string
  created_at: string
  profiles: { first_name: string; last_name: string } | null
}

type GuestProfile = {
  id: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

type ManualMemberNoAbo = {
  id: string
  first_name: string
  last_name: string
  upline_abo_number: string | null
  created_at: string
}

type AdminMembersResponse = {
  pending_verifications: VerificationRequest[]
  unverified_guests: GuestProfile[]
  manual_members_no_abo: ManualMemberNoAbo[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-[#f2cc8f]/30 text-[#7a5c00] border border-[#f2cc8f]',
  approved: 'bg-[#81b29a]/20 text-[#2d6a4f] border border-[#81b29a]/50',
  denied:   'bg-[#bc4749]/10 text-[#bc4749] border border-[#bc4749]/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Subcomponents ────────────────────────────────────────────────────────────────

function CollapsibleResolved({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase mb-3 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
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

// ── ABO Verification Tab ──────────────────────────────────────────────────────────

function AboVerificationTab() {
  const qc = useQueryClient()
  const [directProfileId, setDirectProfileId] = useState('')
  const [directUpline, setDirectUpline] = useState('')
  const [directError, setDirectError] = useState<string | null>(null)
  const [directSuccess, setDirectSuccess] = useState(false)

  const { data, isLoading } = useQuery<AdminMembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const pendingVerifications = data?.pending_verifications ?? []
  const standardPending = pendingVerifications.filter(v => v.request_type !== 'manual')
  const manualPending   = pendingVerifications.filter(v => v.request_type === 'manual')
  const pendingProfileIds = new Set(pendingVerifications.map(v => v.profile_id))

  const directCandidates = (data?.unverified_guests ?? []).filter(
    g => !pendingProfileIds.has(g.id)
  )

  const manualNoAbo = data?.manual_members_no_abo ?? []

  const approveOrDeny = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'deny' }) =>
      fetch(`/api/admin/members/verify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
    },
  })

  const directVerify = useMutation({
    mutationFn: ({ profile_id, upline_abo_number }: { profile_id: string; upline_abo_number: string }) =>
      fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id, upline_abo_number }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      setDirectProfileId('')
      setDirectUpline('')
      setDirectError(null)
      setDirectSuccess(true)
      setTimeout(() => setDirectSuccess(false), 3000)
      qc.invalidateQueries({ queryKey: ['admin-members'] })
    },
    onError: (e: Error) => setDirectError(e.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Standard ABO requests ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          Standard ABO requests — {standardPending.length}
        </p>
        {standardPending.length === 0 ? (
          <div className="rounded-xl border px-5 py-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pending standard requests.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {standardPending.map(v => (
              <div key={v.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {v.profiles?.first_name} {v.profiles?.last_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    ABO {v.claimed_abo} · Upline {v.claimed_upline_abo} · {formatDate(v.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'approve' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'deny' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manual requests (no ABO path) ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          Manual requests — {manualPending.length}
        </p>
        {manualPending.length === 0 ? (
          <div className="rounded-xl border px-5 py-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pending manual requests.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {manualPending.map(v => (
              <div key={v.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {v.profiles?.first_name} {v.profiles?.last_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: '#3E7785' }}
                    >
                      No ABO
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Upline {v.claimed_upline_abo} · {formatDate(v.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'approve' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => approveOrDeny.mutate({ id: v.id, action: 'deny' })}
                    disabled={approveOrDeny.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Members awaiting LOS positioning (approved manual, no ABO) ── */}
      {manualNoAbo.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            Awaiting LOS positioning — {manualNoAbo.length}
          </p>
          <div className="space-y-2">
            {manualNoAbo.map(m => (
              <div key={m.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {m.first_name} {m.last_name}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'rgba(62,119,133,0.15)', color: '#3E7785' }}
                    >
                      No ABO
                    </span>
                  </div>
                  {m.upline_abo_number && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Upline {m.upline_abo_number}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE.approved}`}>
                  approved
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Direct verify (Path C) ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>
          Direct verify
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Directly promote a guest to member without a prior submission.
        </p>
        <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Guest</label>
            <select
              value={directProfileId}
              onChange={e => setDirectProfileId(e.target.value)}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            >
              <option value="">Select a guest…</option>
              {directCandidates.map(g => (
                <option key={g.id} value={g.id}>
                  {g.first_name} {g.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Upline ABO number</label>
            <input
              value={directUpline}
              onChange={e => setDirectUpline(e.target.value)}
              placeholder="e.g. 7010970187"
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          {directError && (
            <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{directError}</p>
          )}
          <button
            onClick={() => {
              setDirectError(null)
              directVerify.mutate({ profile_id: directProfileId, upline_abo_number: directUpline.trim() })
            }}
            disabled={directVerify.isPending || !directProfileId || !directUpline.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            {directVerify.isPending ? 'Verifying…' : directSuccess ? 'Verified ✓' : 'Verify member'}
          </button>
          {directCandidates.length === 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              No guests without a pending request.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Trip Registrations Tab ──────────────────────────────────────────────────────────

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
      return results.flat().filter((r): r is TripRegistration => !r.error)
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
      {trips.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterTripId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterTripId === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
              color: filterTripId === 'all' ? 'white' : 'var(--text-secondary)',
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
                backgroundColor: filterTripId === t.id ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                color: filterTripId === t.id ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        Pending — {pending.length}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pending registrations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="rounded-xl border px-4 py-3.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {r.profile?.first_name} {r.profile?.last_name}
                  {r.profile?.abo_number && (
                    <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {r.profile.abo_number}
                    </span>
                  )}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {tripTitle(r.trip_id)} · {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'var(--brand-teal)' }}
                >
                  Approve
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                >
                  Deny
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => (
          <div key={r.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {r.profile?.first_name} {r.profile?.last_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
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

// ── Event Roles Tab ──────────────────────────────────────────────────────────────────

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
      {eventsWithRequests.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setFilterEventId('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: filterEventId === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
              color: filterEventId === 'all' ? 'white' : 'var(--text-secondary)',
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
                backgroundColor: filterEventId === e.id ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                color: filterEventId === e.id ? 'white' : 'var(--text-secondary)',
              }}
            >
              {e.title}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
        Pending — {pending.length}
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-black/5 rounded-xl animate-pulse" />)}
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border px-5 py-8 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No pending role requests.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(r => (
            <div key={r.id} className="rounded-xl border px-4 py-3.5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {r.profile.first_name} {r.profile.last_name}
                    {r.profile.abo_number && (
                      <span className="font-normal text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {r.profile.abo_number}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.role_label}</span>
                    {' · '}{eventTitle(r.event_id)}
                  </p>
                  {r.note && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                      "{r.note}"
                    </p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => updateMutation.mutate({ id: r.id, status: 'approved' })}
                    disabled={updateMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-teal)' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: r.id, status: 'denied' })}
                    disabled={updateMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CollapsibleResolved count={resolved.length}>
        {resolved.map(r => (
          <div key={r.id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                {r.profile.first_name} {r.profile.last_name}
                {' · '}
                <span className="font-medium">{r.role_label}</span>
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
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

// ── Inner page (needs useSearchParams) ───────────────────────────────────────────

const TABS = [
  { key: 'trips', label: 'Trip Registrations' },
  { key: 'roles', label: 'Event Roles' },
  { key: 'abo',   label: 'ABO Verification' },
] as const
type TabKey = typeof TABS[number]['key']

function ApprovalHubInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'trips') as TabKey

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
