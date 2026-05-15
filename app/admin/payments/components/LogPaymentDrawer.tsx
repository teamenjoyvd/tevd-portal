'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/drawer'
import { t } from '@/lib/i18n'
import { LogPaymentForm } from './LogPaymentForm'
import type { Trip } from '@/lib/types/trips'
import type { PayableItem } from '@/lib/types/items'
import type { MemberProfile, MembersResponse } from '@/lib/types/payments'

export function LogPaymentDrawer({
  open,
  onClose,
  onSave,
  isPending,
  externalError,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => void
  isPending: boolean
  externalError: string | null
}) {
  // Lazy fetch — only runs while drawer is open
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetch('/api/trips').then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: items = [] } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetch('/api/admin/payable-items').then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/admin/members').then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  const allMembers: MemberProfile[] = (() => {
    if (!membersData) return []
    const seen = new Set<string>()
    const out: MemberProfile[] = []
    for (const m of membersData.los_members ?? []) {
      if (m.profile && !seen.has(m.profile.id)) {
        seen.add(m.profile.id)
        out.push(m.profile)
      }
    }
    for (const m of membersData.manual_members_no_abo ?? []) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        out.push({ id: m.id, first_name: m.first_name, last_name: m.last_name, abo_number: null })
      }
    }
    return out.sort((a, b) => a.last_name.localeCompare(b.last_name))
  })()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('admin.operations.payments.drawer.title', 'en')}
    >
      <LogPaymentForm
        trips={trips}
        items={items}
        allMembers={allMembers}
        onSave={onSave}
        onClose={onClose}
        isPending={isPending}
        externalError={externalError}
      />
    </Drawer>
  )
}
