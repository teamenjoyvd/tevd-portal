'use client'

import { useMemo, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatCurrency } from '@/lib/format'
import { uploadToSignedUrl } from '@/lib/utils/uploadToSignedUrl'
import { isBalanced, redistribute, setRowAmount, type SplitRow } from '@/lib/payments/split'
import { BeneficiaryPicker } from './BeneficiaryPicker'
import { SplitEditor } from './SplitEditor'
import type { Beneficiary, PayableItem } from './types'

type TripContext    = { context?: 'trip';   tripId: string }
type GenericContext = { context: 'generic'; payableItems: PayableItem[] }

type PaymentFormProps = (TripContext | GenericContext) & {
  onSuccess?: () => void
  onCancel?:  () => void
  /**
   * Opt in to paying on behalf of others (2607-DEV-676). Default false, so a
   * call site that passes nothing renders and posts exactly as before —
   * rollout and rollback are a one-word flag flip per route.
   */
  allowOnBehalf?: boolean
}

/**
 * Unified payment submission form.
 *
 * context='trip' (or omitted) — posts trip_id, no item selector. Used in AttendeeView.
 * context='generic'           — posts payable_item_id, shows item dropdown. Used in PaymentsSection.
 *
 * Both contexts share identical UX: segmented method control, styled upload
 * zone, required-field legend, forest-green CTA.
 *
 * With allowOnBehalf the form gains a "Who is this for?" block that defaults to
 * just the payer. At one participant it is behaviourally today's form and posts
 * no `beneficiaries` key at all; at two or more, Amount becomes Total and a
 * per-person breakdown appears.
 */
export function PaymentForm(props: PaymentFormProps) {
  const { t } = useLanguage()
  const { onSuccess, onCancel, allowOnBehalf = false } = props
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [itemId, setItemId]   = useState('')
  const [amount, setAmount]   = useState('')
  const [date, setDate]       = useState('')
  const [method, setMethod]   = useState<'cash' | 'bank_transfer'>('cash')
  const [file, setFile]       = useState<File | null>(null)
  const [note, setNote]       = useState('')

  const [participants, setParticipants] = useState<SplitRow[]>([])
  const [pickerOpen, setPickerOpen]     = useState(false)

  const selectedItem = 'payableItems' in props ? props.payableItems.find(i => i.id === itemId) : null
  const currency     = selectedItem?.currency ?? 'EUR'

  // Prefetched on mount so the picker is already warm on the first tap. Not
  // fetched at all when the flag is off, so the legacy call sites make no extra
  // request.
  const { data: beneficiaries = [], isLoading: beneficiariesLoading } = useQuery<Beneficiary[]>({
    queryKey: ['payment-beneficiaries'],
    queryFn: async () => {
      const res = await fetch('/api/payments/beneficiaries')
      if (!res.ok) throw new Error('Could not load beneficiaries')
      return res.json()
    },
    enabled: allowOnBehalf,
    staleTime: 5 * 60 * 1000,
  })

  const self = beneficiaries.find(b => b.relation === 'self') ?? null
  const people = useMemo(
    () => Object.fromEntries(beneficiaries.map(b => [b.profile_id, b])) as Record<string, Beneficiary>,
    [beneficiaries],
  )

  // Amounts live in integer cents; the euro input is only a rendering of them.
  const parsedAmount = parseFloat(amount)
  const totalCents   = Number.isNaN(parsedAmount) ? 0 : Math.round(parsedAmount * 100)

  // The payer is DERIVED as the default participant rather than seeded by an
  // effect: an effect that setStates on load cascades a second render, and it
  // would also race the beneficiaries fetch against a user already typing.
  // Empty state therefore means "just me", and resetting is setParticipants([]).
  const roster = useMemo<SplitRow[]>(() => {
    if (participants.length > 0) return participants
    if (!allowOnBehalf || !self) return []
    return [{ profileId: self.profile_id, amountCents: totalCents, locked: false }]
  }, [participants, allowOnBehalf, self, totalCents])

  /** Re-split across unlocked rows. Redistribution is invalid below one cent,
   *  in which case the rows are left alone — the form is unsubmittable anyway. */
  function rebalance(rows: SplitRow[], total: number): SplitRow[] {
    if (!Number.isInteger(total) || total <= 0 || rows.length === 0) return rows
    return redistribute(rows, total)
  }

  const isOnBehalf = allowOnBehalf && roster.length >= 2

  const submitMutation = useMutation({
    mutationFn: async () => {
      let proof_url: string | null = null

      if (file) {
        proof_url = await uploadToSignedUrl(
          file,
          '/api/profile/payments/upload-url',
          '/api/profile/payments/upload-url/confirm',
        )
      }

      const entity =
        'tripId' in props
          ? { trip_id: props.tripId }
          : { payable_item_id: itemId }

      // Only a genuine multi-person submission carries the group keys. With one
      // participant the body is byte-identical to the legacy form's.
      const onBehalf = isOnBehalf
        ? {
            total_cents: totalCents,
            beneficiaries: roster.map(row => ({
              profile_id:   row.profileId,
              amount_cents: row.amountCents,
            })),
          }
        : {}

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entity,
          amount:           parseFloat(amount),
          currency,
          transaction_date: date,
          payment_method:   method,
          proof_url,
          note: note || null,
          ...onBehalf,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Submission failed')
      return body
    },
    onSuccess: () => {
      if ('tripId' in props) {
        qc.invalidateQueries({ queryKey: ['trip-payments', props.tripId] })
      } else {
        qc.invalidateQueries({ queryKey: ['profile-generic-payments'] })
      }
      setItemId(''); setAmount(''); setDate(''); setMethod('cash'); setFile(null); setNote('')
      setParticipants([]) // empty means "just me" — the roster memo re-derives it
      setPickerOpen(false)
      onSuccess?.()
    },
  })

  const entityValid  = 'tripId' in props ? true : !!itemId
  // On a group submission the shares must add up EXACTLY — the same assertion
  // submit_payment_group makes in SQL, so the button never promises a submit
  // the database will refuse.
  const splitValid   = !isOnBehalf || isBalanced(roster, totalCents)
  const canSubmit    = !isNaN(parsedAmount) && parsedAmount > 0 && !!date && entityValid && splitValid && !submitMutation.isPending

  const inputStyle = {
    backgroundColor: 'var(--bg-global)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
    borderRadius: '0.75rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.875rem',
    width: '100%',
    outline: 'none',
  } as const

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
    color: 'var(--text-secondary)',
  } as const

  // The picker replaces the form inside the SAME drawer rather than opening a
  // nested one — see BeneficiaryPicker for why nesting vaul drawers breaks.
  if (pickerOpen) {
    return (
      <BeneficiaryPicker
        beneficiaries={beneficiaries}
        selectedIds={roster.map(p => p.profileId)}
        isLoading={beneficiariesLoading}
        onBack={() => setPickerOpen(false)}
        onSelect={b => {
          // Built from `roster`, never the raw state: while the payer is still
          // the derived default, raw state is [] and an updater would drop them.
          setParticipants(
            roster.some(p => p.profileId === b.profile_id)
              ? roster
              : rebalance([...roster, { profileId: b.profile_id, amountCents: 0, locked: false }], totalCents),
          )
          setPickerOpen(false)
        }}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Required field legend */}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {t('payment.fieldsRequiredPre')}{' '}
        <span style={{ color: 'var(--brand-crimson)' }}>*</span>
        {' '}{t('payment.fieldsRequiredPost')}
      </p>

      {/* Item selector — generic context only */}
      {'payableItems' in props && (
        <div>
          <label style={labelStyle}>
            {t('payment.item')} <span style={{ color: 'var(--brand-crimson)' }}>*</span>
          </label>
          <select
            value={itemId}
            onChange={e => {
              const id = e.target.value
              setItemId(id)
              const item = props.payableItems.find(i => i.id === id)
              if (item) setAmount(item.amount.toString())
            }}
            style={inputStyle}
          >
            <option value="">{t('payment.selectItem')}</option>
            {props.payableItems.map(item => (
              <option key={item.id} value={item.id}>
                {item.title} — {formatCurrency(item.amount, item.currency)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Who is this for? — only when the flag is on. Defaults to the payer
          alone, at which point everything below behaves exactly as before. */}
      {allowOnBehalf && (
        <div>
          <label style={labelStyle}>{t('payment.whoIsThisFor')}</label>
          <div className="flex flex-wrap gap-2">
            {roster.map(row => {
              const person = people[row.profileId]
              return (
                <span
                  key={row.profileId}
                  className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 text-xs"
                  style={{
                    minHeight: '32px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-global)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {person ? `${person.first_name} ${person.last_name}` : '…'}
                  {roster.length > 1 && (
                    <button
                      type="button"
                      aria-label={t('payment.remove')}
                      onClick={() =>
                        setParticipants(rebalance(roster.filter(p => p.profileId !== row.profileId), totalCents))
                      }
                      className="flex items-center justify-center transition-opacity hover:opacity-70"
                      style={{
                        width: '20px', height: '20px',
                        background: 'none', border: 'none',
                        color: 'var(--text-secondary)', cursor: 'pointer', padding: 0,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </span>
              )
            })}

            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-full px-3 text-xs font-semibold transition-opacity hover:opacity-70"
              style={{
                minHeight: '32px',
                border: '1px dashed var(--border-default)',
                background: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('payment.addPerson')}
            </button>
          </div>
        </div>
      )}

      {/* Amount — labelled Total once the money is being split. */}
      <div>
        <label style={labelStyle}>
          {isOnBehalf ? t('payment.total') : t('payment.amount')} ({currency}){' '}
          <span style={{ color: 'var(--brand-crimson)' }}>*</span>
        </label>
        <input
          type="number" min="0" step="0.01" placeholder="0.00"
          value={amount}
          onChange={e => {
            const next = e.target.value
            setAmount(next)
            const parsed = parseFloat(next)
            const nextTotal = Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
            // Untouched state stays empty so the roster memo keeps deriving
            // the payer at the new total; only a real selection is rebalanced.
            setParticipants(prev => (prev.length === 0 ? prev : rebalance(prev, nextTotal)))
          }}
          style={inputStyle}
        />
      </div>

      {/* Per-person breakdown */}
      {isOnBehalf && (
        <SplitEditor
          rows={roster}
          people={people}
          totalCents={totalCents}
          currency={currency}
          onChangeAmount={(profileId, amountCents) =>
            setParticipants(totalCents > 0 ? setRowAmount(roster, profileId, amountCents, totalCents) : roster)
          }
          onRemove={profileId =>
            setParticipants(rebalance(roster.filter(p => p.profileId !== profileId), totalCents))
          }
        />
      )}

      {/* Date */}
      <div>
        <label style={labelStyle}>
          {t('payment.date')} <span style={{ color: 'var(--brand-crimson)' }}>*</span>
        </label>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Payment Method — segmented control */}
      <div>
        <label style={labelStyle}>{t('payment.method')}</label>
        <div
          className="flex p-1 gap-1 rounded-xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
        >
          {(['cash', 'bank_transfer'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: method === m ? 'var(--bg-card)' : 'transparent',
                color: method === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: method === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {m === 'cash' ? t('payment.cash') : t('payment.bankTransfer')}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label style={labelStyle}>{t('payment.note')}</label>
        <input
          type="text" placeholder={t('payment.noteOptional')}
          value={note} onChange={e => setNote(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Proof of Payment — styled upload zone */}
      <div>
        <label style={labelStyle}>{t('payment.proof')}</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-global)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                {file.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
              className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {t('payment.remove')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-xl py-6 transition-colors hover:bg-black/[0.02]"
            style={{
              border: '1.5px dashed var(--border-default)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {t('payment.uploadProof')}
            </span>
          </button>
        )}
      </div>

      {/* Error */}
      {submitMutation.isError && (
        <p className="text-xs" style={{ color: '#bc4749' }}>
          {(submitMutation.error as Error).message}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            {t('payment.cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            backgroundColor: canSubmit ? 'var(--brand-forest)' : 'rgba(0,0,0,0.12)',
            color: canSubmit ? '#ffffff' : 'var(--text-secondary)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            border: 'none',
          }}
        >
          {submitMutation.isPending ? t('payment.submitting') : t('payment.submit')}
        </button>
      </div>
    </div>
  )
}
