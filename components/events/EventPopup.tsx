'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useState } from 'react'

type RoleRequest = {
  id: string
  role_label: string
  status: 'pending' | 'approved' | 'denied'
  note: string | null
  profile: { id: string; first_name: string; last_name: string; abo_number: string | null }
}

type EventDetail = {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  category: 'N21' | 'Personal'
  week_number: number
  role_requests: RoleRequest[]
}

type Props = {
  eventId: string
  onClose: () => void
  userRole: 'admin' | 'core' | 'member' | 'guest' | null
  userProfileId: string | null
}

const AVAILABLE_ROLES = ['Speaker', 'Host', 'Moderator', 'Volunteer', 'Coordinator']

const STATUS_STYLES = {
  pending:  'bg-[#f2cc8f]/20 text-[#8e6a00] border border-[#f2cc8f]',
  approved: 'bg-[#81b29a]/20 text-[#2d6a4f] border border-[#81b29a]',
  denied:   'bg-[#bc4749]/10 text-[#bc4749] border border-[#bc4749]/30',
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function EventPopup({ eventId, onClose, userRole, userProfileId }: Props) {
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(AVAILABLE_ROLES[0])
  const [note, setNote] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: () => fetch(`/api/events/${eventId}`).then(r => r.json()),
  })

  const myRequest = event?.role_requests.find(r => r.profile?.id === userProfileId)

  const requestMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/events/${eventId}/request-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_label: selectedRole, note: note || null }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      setShowForm(false)
      setNote('')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/events/${eventId}/request-role`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const adminApproveMutation = useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: 'approved' | 'denied' }) =>
      fetch(`/api/admin/event-role-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event', eventId] }),
  })

  const canRequestRole = userRole && userRole !== 'guest'
  const isAdmin = userRole === 'admin'

  const start = event ? formatDateTime(event.start_time) : null
  const end = event ? formatDateTime(event.end_time) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative w-full md:max-w-lg bg-white md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-black/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: event?.category === 'N21' ? 'var(--forest)' : 'var(--sienna)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  {event?.category ?? '…'}
                </span>
                {event && (
                  <span className="text-xs font-medium" style={{ color: 'var(--stone)' }}>
                    W{event.week_number}
                  </span>
                )}
              </div>
              <h2
                className="font-serif text-xl font-semibold leading-snug"
                style={{ color: 'var(--deep)' }}
              >
                {isLoading ? '…' : event?.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
              style={{ color: 'var(--stone)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90dvh - 80px)' }}>
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : event ? (
            <>
              {/* Date & time */}
              <div className="px-5 py-4 border-b border-black/5">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--deep)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--stone)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                  </svg>
                  <span className="font-medium">{start?.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm mt-1.5" style={{ color: 'var(--stone)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--stone)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{start?.time} – {end?.time}</span>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="px-5 py-4 border-b border-black/5">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>
                    {event.description}
                  </p>
                </div>
              )}

              {/* Role requests section */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold tracking-widest uppercase mb-3"
                  style={{ color: 'var(--stone)' }}>
                  Roles
                </p>

                {/* Existing requests — admin sees all, member sees own */}
                {(isAdmin ? event.role_requests : event.role_requests.filter(r => r.profile?.id === userProfileId)).length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {(isAdmin ? event.role_requests : event.role_requests.filter(r => r.profile?.id === userProfileId))
                      .map(r => (
                        <div key={r.id} className="rounded-xl p-3 bg-black/[0.02] border border-black/5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {isAdmin && (
                                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--deep)' }}>
                                  {r.profile?.first_name} {r.profile?.last_name}
                                  {r.profile?.abo_number && (
                                    <span style={{ color: 'var(--stone)' }}> · {r.profile.abo_number}</span>
                                  )}
                                </p>
                              )}
                              <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                                {r.role_label}
                              </p>
                              {r.note && (
                                <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                                  {r.note}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}>
                                {r.status}
                              </span>
                              {/* Admin approve/deny buttons */}
                              {isAdmin && r.status === 'pending' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'approved' })}
                                    className="text-xs px-2 py-1 rounded-lg font-medium"
                                    style={{ backgroundColor: 'var(--sage)', color: 'white' }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => adminApproveMutation.mutate({ requestId: r.id, status: 'denied' })}
                                    className="text-xs px-2 py-1 rounded-lg font-medium bg-black/5"
                                    style={{ color: 'var(--stone)' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                              {/* Member cancel pending request */}
                              {!isAdmin && r.status === 'pending' && (
                                <button
                                  onClick={() => cancelMutation.mutate()}
                                  disabled={cancelMutation.isPending}
                                  className="text-xs px-2 py-1 rounded-lg bg-black/5 disabled:opacity-50"
                                  style={{ color: 'var(--stone)' }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  !isAdmin && canRequestRole && !myRequest && (
                    <p className="text-sm mb-3" style={{ color: 'var(--stone)' }}>
                      No role requests yet for this event.
                    </p>
                  )
                )}

                {/* Request role form — members only, no existing request */}
                {canRequestRole && !myRequest && !isAdmin && (
                  <>
                    {!showForm ? (
                      <button
                        onClick={() => setShowForm(true)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-colors"
                        style={{ borderColor: 'var(--crimson)', color: 'var(--crimson)' }}
                      >
                        + Request a role
                      </button>
                    ) : (
                      <div className="rounded-xl border border-black/10 p-4 space-y-3">
                        <div>
                          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--stone)' }}>
                            Role
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {AVAILABLE_ROLES.map(role => (
                              <button
                                key={role}
                                onClick={() => setSelectedRole(role)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                style={{
                                  backgroundColor: selectedRole === role ? 'var(--deep)' : 'var(--eggshell)',
                                  color: selectedRole === role ? 'white' : 'var(--deep)',
                                }}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--stone)' }}>
                            Note <span style={{ color: 'var(--stone)', fontWeight: 400 }}>(optional)</span>
                          </label>
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Add context for your request…"
                            rows={2}
                            className="w-full text-sm rounded-lg px-3 py-2 border border-black/10 resize-none"
                            style={{ color: 'var(--deep)' }}
                          />
                        </div>
                        {requestMutation.isError && (
                          <p className="text-xs" style={{ color: 'var(--crimson)' }}>
                            {(requestMutation.error as Error).message}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => requestMutation.mutate()}
                            disabled={requestMutation.isPending}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
                            style={{ backgroundColor: 'var(--crimson)' }}
                          >
                            {requestMutation.isPending ? 'Submitting…' : 'Submit request'}
                          </button>
                          <button
                            onClick={() => { setShowForm(false); setNote('') }}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-black/5"
                            style={{ color: 'var(--stone)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Guest message */}
                {!canRequestRole && (
                  <p className="text-sm" style={{ color: 'var(--stone)' }}>
                    Sign in to request a role for this event.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}