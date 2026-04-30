'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { verifyMember, promoteMember } from '@/lib/actions/members'
import { MembersTable } from './MembersTable'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LOSMember = {
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

export type MembersData = {
  los_members: LOSMember[]
  pending_verifications: VerificationRequest[]
  unverified_guests: Guest[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ── MembersTab ────────────────────────────────────────────────────────────────

export function MembersTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [denyNote, setDenyNote] = useState<Record<string, string>>({})
  const [showDenyInput, setShowDenyInput] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['admin-members-full'],
    queryFn: () => fetch('/api/admin/members').then(r => {
      if (!r.ok) throw new Error(r.statusText)
      return r.json()
    }),
  })

  const verifyMutation = useMutation({
    mutationFn: verifyMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members-full'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: promoteMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members-full'] }),
  })

  const handlePromote = useCallback((profileId: string, role: string) => {
    promoteMutation.mutate({ profileId, role })
  }, [promoteMutation])

  const losMembers = data?.los_members ?? []
  const pendingVerifications = data?.pending_verifications ?? []
  const unverifiedGuests = data?.unverified_guests ?? []

  return (
    <div className="space-y-8">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.members.summary.losLinked').replace('{{total}}', String(losMembers.length)).replace('{{linked}}', String(losMembers.filter(m => m.profile).length))}
      </p>

      {pendingVerifications.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}>
            {t('admin.members.pendingVerification')}
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {pendingVerifications.length}
            </span>
          </p>
          <div className="space-y-2">
            {pendingVerifications.map(v => {
              const losMatch = losMembers.find(m => m.abo_number === v.claimed_abo)
              const uplineMatch = losMatch?.sponsor_abo_number === v.claimed_upline_abo
              const fullMatch = losMatch && uplineMatch
              return (
                <div key={v.id} className="rounded-2xl border shadow-sm p-4"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: fullMatch ? '#81b29a50' : '#f2cc8f80' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {v.profiles?.first_name} {v.profiles?.last_name}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={fullMatch
                            ? { backgroundColor: '#81b29a33', color: '#2d6a4f' }
                            : { backgroundColor: '#f2cc8f33', color: '#7a5c00' }}>
                          {fullMatch ? t('admin.members.verify.losMatch') : losMatch ? t('admin.members.verify.uplineMismatch') : t('admin.members.verify.noAboInLos')}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {t('admin.members.verify.claimsAbo')} <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_abo}</span>{' · '}{t('admin.members.verify.upline')} <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{v.claimed_upline_abo}</span>
                      </p>
                      {losMatch && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {t('admin.members.verify.los')} <span style={{ color: 'var(--text-primary)' }}>{losMatch.name}</span>{' · '}{t('admin.members.verify.sponsorInLos')} <span style={{ color: uplineMatch ? '#2d6a4f' : 'var(--brand-crimson)' }}>
                            {losMatch.sponsor_abo_number ?? '—'}
                          </span>
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{timeAgo(v.created_at)}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'approve' })}
                        disabled={verifyMutation.isPending}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--brand-teal)' }}>{t('admin.members.verify.btn.approve')}</button>
                      {!showDenyInput[v.id] ? (
                        <button onClick={() => setShowDenyInput(s => ({ ...s, [v.id]: true }))}
                          className="px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-primary)' }}>{t('admin.members.verify.btn.deny')}</button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input value={denyNote[v.id] ?? ''}
                            onChange={e => setDenyNote(s => ({ ...s, [v.id]: e.target.value }))}
                            placeholder={t('admin.members.verify.reasonPlaceholder')}
                            className="border border-black/10 rounded-lg px-2 py-1 text-xs w-36"
                            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                          <button onClick={() => verifyMutation.mutate({ id: v.id, action: 'deny', admin_note: denyNote[v.id] })}
                            disabled={verifyMutation.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                            style={{ backgroundColor: 'var(--brand-crimson)' }}>{t('admin.members.verify.btn.confirm')}</button>
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

      {unverifiedGuests.length > 0 && (
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
            {t('admin.members.guestsNoAbo').replace('{{count}}', String(unverifiedGuests.length))}
          </p>
          <div className="rounded-2xl border shadow-sm divide-y" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            {unverifiedGuests.map(g => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{g.first_name} {g.last_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('admin.members.guestJoined')} {timeAgo(g.created_at)}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}>{t('admin.members.guestRole')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.members.losMapDesc').replace('{{count}}', String(losMembers.length))}
        </p>
        <MembersTable
          members={losMembers}
          isLoading={isLoading}
          onPromote={handlePromote}
          promotePending={promoteMutation.isPending}
        />
      </section>
    </div>
  )
}
