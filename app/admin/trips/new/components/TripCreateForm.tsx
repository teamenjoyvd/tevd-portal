'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_ROLES } from '@/lib/roles'

type FormState = {
  title: string
  destination: string
  description: string
  start_date: string
  end_date: string
  total_cost: string
}

// Defined at module scope — Admin forms gotcha: never define inside a parent component body
export function TripCreateForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    title: '', destination: '', description: '',
    start_date: '', end_date: '', total_cost: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = !!form.title && !!form.destination && !!form.start_date && !!form.end_date

  function field(key: keyof FormState) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  async function handleSubmit() {
    if (!isValid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          destination: form.destination,
          description: form.description,
          start_date: form.start_date,
          end_date: form.end_date,
          total_cost: Number(form.total_cost) || 0,
          access_roles: [...ALL_ROLES],
        }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      const trip = await r.json() as { id: string }
      router.push(`/admin/trips/${trip.id}`)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full border rounded-xl px-3 py-2 text-sm'
  const inputStyle = {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4 max-w-lg"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title *</label>
          <input className={inputCls} style={inputStyle} {...field('title')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Destination *</label>
          <input className={inputCls} style={inputStyle} {...field('destination')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea className={inputCls} style={inputStyle} rows={3} {...field('description')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start date *</label>
            <input type="date" className={inputCls} style={inputStyle} {...field('start_date')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>End date *</label>
            <input type="date" className={inputCls} style={inputStyle} {...field('end_date')} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total cost (EUR)</label>
          <input type="number" className={inputCls} style={inputStyle} {...field('total_cost')} />
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <div className="space-y-2">
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {submitting ? 'Creating…' : 'Create Trip'}
        </button>
        <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
          Files and hero image available after creation.
        </p>
      </div>
    </div>
  )
}
