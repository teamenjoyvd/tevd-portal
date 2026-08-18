'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDate } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { fetchJson } from '@/lib/utils/fetchJson'
import { dedupeMembers } from './members'
import type { MembersResponse } from '@/lib/types/payments'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/** One row of GET /api/admin/payment-guests. */
type PaymentGuest = {
  id: string
  name: string
  email: string | null
  created_at: string
  linked_profile_id: string | null
  owner: { id: string; first_name: string; last_name: string; abo_number: string | null } | null
  linked: { id: string; first_name: string; last_name: string; abo_number: string | null } | null
  payment_count: number
}

/**
 * Links ad-hoc guests to real members (2607-DEV-677).
 *
 * A guest is free text typed by a payer — no account, no ABO, no verification.
 * Once an admin recognises who they are, this records it.
 *
 * A RECORD ONLY: no money moves and no `payments` row is rewritten. The guest's
 * payments stay on the payer's ledger, which is where the payer's financial
 * responsibility for them put them.
 *
 * Manual on purpose. Nothing here matches on email, because `profiles.contact_email`
 * is user-editable and unverified, so auto-matching would let anyone claim a
 * stranger's guest history by typing their address.
 */
export function GuestLinkPanel() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const router = useRouter()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [unlinkTarget, setUnlinkTarget] = useState<PaymentGuest | null>(null)

  const { data: guests = [], isLoading, isError, error } = useQuery<PaymentGuest[]>({
    queryKey: ['admin-payment-guests'],
    queryFn: () => fetchJson<PaymentGuest[]>('/api/admin/payment-guests'),
    staleTime: 60_000,
  })

  // The same cache entry LogPaymentDrawer fills, so opening the drawer first
  // makes this list instant and vice versa.
  const { data: membersData } = useQuery<MembersResponse>({
    queryKey: ['admin-members'],
    queryFn: () => fetchJson<MembersResponse>('/api/admin/members'),
    staleTime: 60_000,
  })
  const allMembers = useMemo(() => dedupeMembers(membersData), [membersData])

  const linkMutation = useMutation({
    mutationFn: ({ id, linked_profile_id }: { id: string; linked_profile_id: string | null }) =>
      fetch(`/api/admin/payment-guests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linked_profile_id }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-payment-guests'] })
      // The panel is not the only surface reading this link. PaymentsClient and
      // PaymentGroupCard render `payment_guests.linked_profile_id` from the
      // SERVER props built in app/admin/payments/page.tsx, which no react-query
      // invalidation reaches — without this the payment rows keep showing the
      // `payment.guestUnlinked` badge until the admin reloads the page.
      router.refresh()
    },
    onSettled: () => setUnlinkTarget(null),
  })

  if (isLoading) return null

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('payment.guestLinkTitle')}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.guestLinkHint')}
        </p>
      </div>

      {/* Mutation failures must be visible here: on success the list refetches
          and the row moves, so a silent failure is indistinguishable from a
          click that never registered. */}
      {linkMutation.isError && (
        <p className="px-5 pb-2 text-xs" style={{ color: 'var(--status-alert-fg)' }} role="alert">
          {(linkMutation.error as Error).message}
        </p>
      )}

      {/* A failed fetch leaves `guests` at its [] default with isLoading false,
          which renders identically to "nothing to reconcile" — so the admin
          reads a broken request as an empty queue. Distinguished before the
          empty case, never merged into it. */}
      {isError ? (
        <p className="px-5 pb-4 text-xs" style={{ color: 'var(--status-alert-fg)' }} role="alert">
          {(error as Error).message}
        </p>
      ) : guests.length === 0 ? (
        <p className="px-5 pb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.guestLinkEmpty')}
        </p>
      ) : (
        guests.map((guest, i) => {
          // '' is "nothing chosen yet" — the Select's own empty value.
          const chosen = draft[guest.id] ?? ''
          return (
          <div
            key={guest.id}
            // Stacks at 390px, one row per guest from sm up.
            className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {guest.name}
                {guest.linked_profile_id === null && (
                  <span
                    className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold align-middle"
                    style={{ backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' }}
                  >
                    {t('payment.guestUnlinked')}
                  </span>
                )}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {guest.email ? `${guest.email} · ` : ''}
                {guest.payment_count} {t('payment.guestPayments')}
                {' · '}{formatDate(guest.created_at)}
                {guest.owner && ` · ${t('payment.guestPaidBy')} ${guest.owner.first_name} ${guest.owner.last_name}`}
              </p>
              {guest.linked && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {t('payment.guestLinkedTo')}{' '}
                  <span style={{ color: 'var(--text-primary)' }}>
                    {guest.linked.first_name} {guest.linked.last_name}
                  </span>
                  {guest.linked.abo_number && (
                    <span className="font-mono ml-1.5 opacity-60">{guest.linked.abo_number}</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              {guest.linked_profile_id === null ? (
                <>
                  <Select
                    value={chosen}
                    onValueChange={val => setDraft(d => ({ ...d, [guest.id]: val }))}
                  >
                    <SelectTrigger className="min-w-[10rem]">
                      <SelectValue placeholder={t('payment.guestSelectMember')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.first_name} {m.last_name}{m.abo_number ? ` · ${m.abo_number}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => linkMutation.mutate({ id: guest.id, linked_profile_id: chosen })}
                    // Compared to an empty string explicitly rather than
                    // truthiness-checked: '' is the Select's unchosen value and
                    // is the only value that must block the click.
                    disabled={chosen === '' || linkMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-forest)' }}
                  >
                    {t('payment.guestLink')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setUnlinkTarget(guest)}
                  disabled={linkMutation.isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border disabled:opacity-40 transition-colors hover:bg-hover-surface"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--status-alert-fg)' }}
                >
                  {t('payment.guestUnlink')}
                </button>
              )}
            </div>
          </div>
          )
        })
      )}

      <AlertDialog
        open={unlinkTarget !== null}
        onOpenChange={open => { if (!open && !linkMutation.isPending) setUnlinkTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('payment.guestUnlinkTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('payment.guestUnlinkBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={linkMutation.isPending}>
              {t('payment.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={linkMutation.isPending}
              onClick={e => {
                e.preventDefault()
                if (unlinkTarget !== null) {
                  linkMutation.mutate({ id: unlinkTarget.id, linked_profile_id: null })
                }
              }}
            >
              {t('payment.guestUnlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
