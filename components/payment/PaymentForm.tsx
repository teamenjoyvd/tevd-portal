'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Props {
  tripId: string
  onSuccess: () => void
  onCancel: () => void
}

export function PaymentForm({ tripId, onSuccess }: Props) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const submitMutation = useMutation({
    mutationFn: async () => {
      let proof_url: string | null = null

      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/profile/payments/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) throw new Error((await uploadRes.json()).error ?? 'Upload failed')
        const { url } = await uploadRes.json()
        proof_url = url
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          amount: parseFloat(amount),
          currency: 'EUR',
          transaction_date: date,
          payment_method: method,
          proof_url,
          note: note || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Submission failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-payments', tripId] })
      onSuccess()
      setAmount('')
      setDate('')
      setMethod('cash')
      setFile(null)
      setNote('')
    },
  })

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

  const pillBase: React.CSSProperties = {
    flex: 1,
    padding: '0.5rem 0',
    borderRadius: '0.625rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
    border: 'none',
  }

  return (
    <div className="space-y-5">
      <div>
        <label style={labelStyle}>Amount (EUR) *</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Payment Date *</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Payment Method</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMethod('cash')}
            style={{
              ...pillBase,
              backgroundColor: method === 'cash' ? '#bc4749' : 'transparent',
              color: method === 'cash' ? '#ffffff' : 'var(--text-secondary)',
              border: method === 'cash' ? 'none' : '1px solid var(--border-default)',
            }}
          >
            Cash
          </button>
          <button
            type="button"
            onClick={() => setMethod('bank_transfer')}
            style={{
              ...pillBase,
              backgroundColor: method === 'bank_transfer' ? '#bc4749' : 'transparent',
              color: method === 'bank_transfer' ? '#ffffff' : 'var(--text-secondary)',
              border: method === 'bank_transfer' ? 'none' : '1px solid var(--border-default)',
            }}
          >
            Bank Transfer
          </button>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Note</label>
        <input
          type="text"
          placeholder="Optional note"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Proof of Payment</label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          style={{ ...inputStyle, padding: '0.5rem' }}
        />
      </div>

      {submitMutation.isError && (
        <p className="text-xs" style={{ color: '#bc4749' }}>
          {(submitMutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || !amount || !date}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--brand-forest)' }}
      >
        {submitMutation.isPending ? 'Submitting…' : 'Submit Payment'}
      </button>
    </div>
  )
}
