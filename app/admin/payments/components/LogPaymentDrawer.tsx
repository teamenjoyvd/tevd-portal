'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { fetchJson } from '@/lib/utils/fetchJson'
import { LogPaymentForm } from './LogPaymentForm'
import { dedupeMembers } from './members'
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
  const { t } = useLanguage()

  // Lazy fetch — only runs while drawer is open
  const { data: trips = [] } = useQuery<Trip[]>({
    queryKey: ['trips'],
    queryFn: () => fetchJson<Trip[]>('/api/trips'),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: items = [] } = useQuery<PayableItem[]>({
    queryKey: ['payable-items'],
    queryFn: () => fetchJson<PayableItem[]>('/api/admin/payable-items'),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetchJson<MembersResponse>('/api/admin/members'),
    enabled: open,
    staleTime: 60_000,
  })

  // Hoisted to module scope in ./members so GuestLinkPanel shares the same
  // definition off the same ['admin-members'] cache entry (2607-DEV-677).
  const allMembers: MemberProfile[] = useMemo(() => dedupeMembers(membersData), [membersData])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('admin.operations.payments.drawer.title')}
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
