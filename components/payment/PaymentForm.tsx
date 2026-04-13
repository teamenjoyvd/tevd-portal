'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'
import type { PayableItem } from './types'

type TripContext    = { context?: 'trip';   tripId: string }
type GenericContext = { context: 'generic'; payableItems: PayableItem[] }

type PaymentFormProps = (TripContext | GenericContext) & {
  onSuccess?: () => void
  onCancel?:  () => void
}

/**
 * Unified payment submission form.
 *
 * context='trip' (or omitted) — posts trip_id, no item selector. Used in AttendeeView.
 * context='generic'           — posts payable_item_id, shows item dropdown. Used in PaymentsSection.
 *
 * Both contexts share identical UX: segmented method control, styled upload
 * zone, required-field legend, forest-green CTA.
 */
export function PaymentForm(props: PaymentFormProps) {
  const { onSuccess, onCancel } = props
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [itemId, setItemId]   = useState('')
  const [amount, setAmount]   = useState('')
  const [date, setDate]       = useState('')
  const [method, setMethod]   = useState<'cash' | 'bank_transfer'>('cash')
  const [file, setFile]       = useState<File | null>(null)
  const [note, setNote]       = useState('')

  const selectedItem = 'payableItems' in props ? props.payableItems.find(i => i.id === itemId) : null
  const currency     = selectedItem?.currency ?? 'EUR'

  const submitMutation = useMutation({
    mutationFn: async () => {
      let proof_url: string | null = null

      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        const uploadBody = await uploadRes.json().catch(() => ({}))
        if (!uploadRes.ok) throw new Error(uploadBody.error ?? 'Upload failed')
        proof_url = uploadBody.url
      }

      const entity =
        'tripId' in props
          ? { trip_id: props.tripId }
          : { payable_item_id: itemId }

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
      onSuccess?.()
    },
  })

  const parsedAmount = parseFloat(amount)
  const entityValid  = 'tripId' in props ? true : !!itemId
  const canSubmit    = !isNaN(parsedAmount) && parsedAmount > 0 && !!date && entityValid && !submitMutation.isPending

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

  return (
    <div className="space-y-5">
      {/* Required field legend */}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Fields marked <span style={{ color: 'var(--brand-crimson)' }}>*</span> are required.
      </p>

      {/* Item selector — generic context only */}
      {'payableItems' in props && (
        <div>
          <label style={labelStyle}>
            Item <span style={{ color: 'var(--brand-crimson)' }}>*</span>
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
            <option value="">Select an item…</option>
            {props.payableItems.map(item => (
              <option key={item.id} value={item.id}>
                {item.title} — {formatCurrency(item.amount, item.currency)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Amount */}
      <div>
        <label style={labelStyle}>
          Amount ({currency}) <span style={{ color: 'var(--brand-crimson)' }}>*</span>
        </label>
        <input
          type="number" min="0" step="0.01" placeholder="0.00"
          value={amount} onChange={e => setAmount(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Date */}
      <div>
        <label style={labelStyle}>
          Payment Date <span style={{ color: 'var(--brand-crimson)' }}>*</span>
        </label>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Payment Method — segmented control */}
      <div>
        <label style={labelStyle}>Payment Method</label>
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
              {m === 'cash' ? 'Cash' : 'Bank Transfer'}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label style={labelStyle}>Note</label>
        <input
          type="text" placeholder="Optional note"
          value={note} onChange={e => setNote(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Proof of Payment — styled upload zone */}
      <div>
        <label style={labelStyle}>Proof of Payment</label>
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
              Remove
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
              Upload proof (PDF or image)
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
            Cancel
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
          {submitMutation.isPending ? 'Submitting…' : 'Submit Payment'}
        </button>
      </div>
    </div>
  )
}
