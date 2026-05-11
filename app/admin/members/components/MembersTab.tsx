'use client'

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { promoteMember } from '@/lib/actions/members'
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
    primary_profile_id: string | null
  } | null
}

export type MembersData = {
  los_members: LOSMember[]
}

// ── MembersTab ────────────────────────────────────────────────────────────────

export function MembersTab() {
  const { t } = useLanguage()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<MembersData>({
    queryKey: ['admin-members-full'],
    queryFn: () => fetch('/api/admin/members').then(r => {
      if (!r.ok) throw new Error(r.statusText)
      return r.json()
    }),
  })

  const promoteMutation = useMutation({
    mutationFn: promoteMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-members-full'] }),
  })

  const handlePromote = useCallback((profileId: string, role: string) => {
    promoteMutation.mutate({ profileId, role })
  }, [promoteMutation])

  const losMembers = data?.los_members ?? []

  return (
    <div className="space-y-8">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.members.summary.losLinked')
          .replace('{{total}}', String(losMembers.length))
          .replace('{{linked}}', String(losMembers.filter(m => m.profile).length))}
      </p>

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
