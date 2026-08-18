'use client'

import { useState, useMemo } from 'react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectGroup,
} from '@/components/ui/select'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Trip } from '@/lib/types/trips'
import type { PayableItem } from '@/lib/types/items'
import type { MemberProfile } from '@/lib/types/payments'

export function LogPaymentForm({
  trips,
  items,
  allMembers,
  onSave,
  onClose,
  isPending,
  externalError,
}: {
  trips: Trip[]
  items: PayableItem[]
  allMembers: MemberProfile[]
  onSave: (payload: Record<string, unknown>) => void
  onClose: () => void
  isPending: boolean
  externalError: string | null
}) {
  const { t } = useLanguage()
  const [entity, setEntity] = useState('')
  const [profileId, setProfileId] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = useState('')
  const [payStatus, setPayStatus] = useState<'approved' | 'pending'>('approved')
  const [note, setNote] = useState('')

  const activeItems = useMemo(() => items.filter(i => i.is_active), [items])

  function handleLog() {
    if (entity === '' || profileId === '' || amount === '') return
    const [type, id] = entity.split('::')
    const body: Record<string, unknown> = {
      profile_id: profileId,
      amount: Number(amount),
      currency,
      transaction_date: txDate,
      payment_method: method === '' ? null : method,
      note: note === '' ? null : note,
      admin_status: payStatus,
    }
    if (type === 'trip') body.trip_id = id
    else body.payable_item_id = id
    onSave(body)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.entity')}</label>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger><SelectValue placeholder={t('admin.operations.payments.placeholder.entity')} /></SelectTrigger>
          <SelectContent>
            {trips.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('admin.operations.payments.group.trips')}</SelectLabel>
                {trips.map(tr => <SelectItem key={tr.id} value={`trip::${tr.id}`}>{tr.title}</SelectItem>)}
              </SelectGroup>
            )}
            {trips.length > 0 && activeItems.length > 0 && <SelectSeparator />}
            {activeItems.length > 0 && (
              <SelectGroup>
                <SelectLabel>{t('admin.operations.payments.group.items')}</SelectLabel>
                {activeItems.map(it => <SelectItem key={it.id} value={`item::${it.id}`}>{it.title}</SelectItem>)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.member')}</label>
        <Select value={profileId} onValueChange={setProfileId}>
          <SelectTrigger><SelectValue placeholder={t('admin.operations.payments.placeholder.member')} /></SelectTrigger>
          <SelectContent>
            {allMembers.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.last_name}, {m.first_name}{m.abo_number ? ` · ${m.abo_number}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.amount')}</label>
          <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.currency')}</label>
          <input value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.date')}</label>
          <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.method')}</label>
          <input value={method} onChange={e => setMethod(e.target.value)}
            placeholder={t('admin.operations.payments.placeholder.method')}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.payments.lbl.status')}</label>
        <Select value={payStatus} onValueChange={val => setPayStatus(val as 'approved' | 'pending')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="approved">{t('admin.operations.payments.status.approved')}</SelectItem>
            <SelectItem value="pending">{t('admin.operations.payments.status.pending')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.operations.payments.lbl.note')} <span className="opacity-60 font-normal">{t('admin.operations.payments.lbl.noteOptional')}</span>
        </label>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder={t('admin.operations.payments.placeholder.note')}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      </div>
      {externalError !== null && externalError !== '' && <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }}>{externalError}</p>}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          onClick={handleLog}
          disabled={isPending || entity === '' || profileId === '' || amount === '' || Number(amount) <= 0}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? t('admin.operations.payments.btn.saving') : t('admin.operations.payments.btn.log2')}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-hover-surface"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >{t('admin.operations.payments.btn.cancel')}</button>
      </div>
    </div>
  )
}
