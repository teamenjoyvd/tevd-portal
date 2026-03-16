'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type LOSMember = {
  abo_number: string
  sponsor_abo_number: string | null
  abo_level: string | null
  name: string | null
  country: string | null
  gpv: number
  ppv: number
  bonus_percent: number
  group_size: number
  annual_ppv: number
  renewal_date: string | null
  profile: {
    id: string
    first_name: string
    last_name: string
    role: string
  } | null
}

type VerificationRequest = {
  id: string
  profile_id: string
  claimed_abo: string
  claimed_upline_abo: string
  status: string
  created_at: string
  profiles: { first_name: string; last_name: string } | null
}

type Guest = {
  id: string
  first_name: string
  last_name: string
  role: string
  created_at: string
}

type MembersData = {
  los_members: LOSMember[]
  pending_verifications: VerificationRequest[]
  unverified_guests: Guest[]
}

function formatNum(n: number) {
  return new Intl.NumberFormat('en-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const LEVEL_BG: Record<string, { bg: string; color: string }> = {
  '1': { bg: 'var(--forest)', color: 'white' },
  '2': { bg: 'var(--sienna)', color: 'white' },
  '3': { bg: 'rgba(0,0,0,0.08)', color: 'var(--deep)' },
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  member: { bg: '#81b29a33', color: '#2d6a4f' },
  core:   { bg: 'var(--sienna)', color: 'white' },
  admin:  { bg: 'var(--deep)', color: 'white' },
  guest:  { bg: 'rgba(0,0,0,0.06)', color: 'var(--stone)' },
}

export default function AdminMembersPage() {
  const qc = useQueryClient()
  const [denyNote, setDenyNote] = useState<Record<string, string>>({})
  const [showDenyInput, setShowDenyInput] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['admin-members-full'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
  })

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, admin_note }: { id: string; action: 'approve' | 'deny'; admin_note?: string }) =>
      fetch(`/api/admin/members/verify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_note }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members-full'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: string }) =>
      fetch(`/api/admin/members/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members-full'] }),
  })

  const losMembers = data?.los_members ?? []
  const pendingVerifications = data?.pending_verifications ?? []
  const unverifiedGuests = data?.unverified_guests ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold" style={{ color: 'var(--deep)' }}>
          Members
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--stone)' }}>
          {losMembers.length} in LOS · {losMembers.filter(m => m.profile).length} linked to portal accounts
        </p>
      </div>

      {/* ── Pending verifications ── */}
      {pendingVerifications.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2"
            style={{ color: 'var(--stone)' }}>
            Pending verification
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--crimson)' }}>
              {pendingVerifications.length}
            </span>
          </p>
          <div className="space-y-2">
            {pendingVerifications.map(v => {
              const losMatch = losMembers.find(m => m.abo_number === v.claimed_abo)
              const uplineMatch = losMatch?.sponsor_abo_number === v.claimed_upline_abo
              const fullMatch = losMatch && uplineMatch
              return (
                <div key={v.id}
                  className="bg-white rounded-2xl border shadow-sm p-4"
                  style={{ borderColor: fullMatch ? '#81b29a50' : '#f2cc8f80' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--deep)' }}>
                          {v.profiles?.first_name} {v.profiles?.last_name}
                        </p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={fullMatch
                            ? { backgroundColor: '#81b29a33', color: '#2d6a4f' }
                            : { backgroundColor: '#f2cc8f33', color: '#7a5c00' }}
                        >
                          {fullMatch ? '✓ LOS match' : losMatch ? '⚠ upline mismatch' : '✗ ABO not in LOS'}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--stone)' }}>
                        Claims ABO <span className="font-mono font-medium" style={{ color: 'var(--deep)' }}>{v.claimed_abo}</span>
                        {' · '}upline <span className="font-mono font-medium" style={{ color: 'var(--deep)' }}>{v.claimed_upline_abo}</span>
                      </p>
                      {losMatch && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                          LOS: <span style={{ color: 'var(--deep)' }}>{losMatch.name}</span>
                          {' · '}sponsor in LOS: <span style={{ color: uplineMatch ? '#2d6a4f' : 'var(--crimson)' }}>
                            {losMatch.sponsor_abo_number ?? '—'}
                          </span>
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                        {timeAgo(v.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => verifyMutation.mutate({ id: v.id, action: 'approve' })}
                        disabled={verifyMutation.isPending}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--sage)' }}
                      >
                        Approve
                      </button>
                      {!showDenyInput[v.id] ? (
                        <button
                          onClick={() => setShowDenyInput(s => ({ ...s, [v.id]: true }))}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--deep)' }}
                        >
                          Deny
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input
                            value={denyNote[v.id] ?? ''}
                            onChange={e => setDenyNote(s => ({ ...s, [v.id]: e.target.value }))}
                            placeholder="Reason (optional)"
                            className="border border-black/10 rounded-lg px-2 py-1 text-xs w-36"
                            style={{ color: 'var(--deep)' }}
                          />
                          <button
                            onClick={() => verifyMutation.mutate({ id: v.id, action: 'deny', admin_note: denyNote[v.id] })}
                            disabled={verifyMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: 'var(--crimson)' }}
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Unverified guests (signed up but no ABO submitted) ── */}
      {unverifiedGuests.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'var(--stone)' }}>
            Guests — no ABO submitted ({unverifiedGuests.length})
          </p>
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm divide-y divide-black/5">
            {unverifiedGuests.map(g => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--deep)' }}>
                    {g.first_name} {g.last_name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                    Joined {timeAgo(g.created_at)}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--stone)' }}>
                  guest
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── LOS map ── */}
      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3"
          style={{ color: 'var(--stone)' }}>
          LOS map — {losMembers.length} members
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-14 rounded-2xl animate-pulse"
                style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
            ))}
          </div>
        ) : losMembers.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-black/5">
            <p className="text-sm" style={{ color: 'var(--stone)' }}>
              No LOS data. Import a CSV in Data Center.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            {losMembers.map((m, i) => {
              const lvl = m.abo_level ?? '?'
              const lc = LEVEL_BG[lvl] ?? LEVEL_BG['3']
              return (
                <div key={m.abo_number}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>

                  {/* Level */}
                  <span className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: lc.bg, color: lc.color }}>
                    {lvl}
                  </span>

                  {/* Name + ABO */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--deep)' }}>
                        {m.name ?? '—'}
                      </p>
                      {m.profile && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={ROLE_BADGE[m.profile.role] ?? ROLE_BADGE.guest}>
                          {m.profile.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
                      {m.abo_number}
                      {m.sponsor_abo_number && ` · ↑ ${m.sponsor_abo_number}`}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-xs tabular-nums flex-shrink-0"
                    style={{ color: 'var(--stone)' }}>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: 'var(--deep)' }}>{formatNum(m.gpv)}</p>
                      <p>GPV</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: Number(m.bonus_percent) > 0 ? 'var(--sage)' : 'var(--stone)' }}>
                        {m.bonus_percent}%
                      </p>
                      <p>Bonus</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: 'var(--deep)' }}>{m.group_size}</p>
                      <p>Group</p>
                    </div>
                  </div>

                  {/* Role promotion for linked portal users */}
                  {m.profile && m.profile.role !== 'admin' && (
                    <div className="flex gap-1 flex-shrink-0">
                      {m.profile.role === 'member' && (
                        <button
                          onClick={() => promoteMutation.mutate({ profileId: m.profile!.id, role: 'core' })}
                          disabled={promoteMutation.isPending}
                          className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: 'var(--sienna)', color: 'white' }}
                        >
                          → Core
                        </button>
                      )}
                      {m.profile.role === 'core' && (
                        <button
                          onClick={() => promoteMutation.mutate({ profileId: m.profile!.id, role: 'member' })}
                          disabled={promoteMutation.isPending}
                          className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--stone)' }}
                        >
                          → Member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}