'use client'

import { useState } from 'react'
import type { Trip } from '@/lib/types/trips'

type MetaFormState = {
  title: string
  destination: string
  start_date: string
  end_date: string
  total_cost: number
  location: string
  trip_type: string
  accommodation_type: string
  inclusions: string
}

function toFormState(trip: Trip): MetaFormState {
  return {
    title: trip.title,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    total_cost: trip.total_cost,
    location: trip.location ?? '',
    trip_type: trip.trip_type ?? '',
    accommodation_type: trip.accommodation_type ?? '',
    inclusions: trip.inclusions.join(', '),
  }
}

export function TripMetaForm({ trip }: { trip: Trip }) {
  const [form, setForm] = useState<MetaFormState>(() => toFormState(trip))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function field(key: keyof MetaFormState) {
    return {
      value: String(form[key]),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value })),
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const payload = {
        title: form.title,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        total_cost: Number(form.total_cost),
        location: form.location || null,
        trip_type: form.trip_type || null,
        accommodation_type: form.accommodation_type || null,
        inclusions: form.inclusions
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      }
      const r = await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border rounded-xl px-3 py-2 text-sm'
  const inputStyle = {
    borderColor: 'var(--border-default)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-card)',
  }

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Details</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
          <input className={inputCls} style={inputStyle} {...field('title')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Destination</label>
          <input className={inputCls} style={inputStyle} {...field('destination')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start date</label>
            <input type="date" className={inputCls} style={inputStyle} {...field('start_date')} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>End date</label>
            <input type="date" className={inputCls} style={inputStyle} {...field('end_date')} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total cost (EUR)</label>
          <input type="number" className={inputCls} style={inputStyle} {...field('total_cost')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Location</label>
          <input className={inputCls} style={inputStyle} {...field('location')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Trip type</label>
          <input className={inputCls} style={inputStyle} {...field('trip_type')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Accommodation</label>
          <input className={inputCls} style={inputStyle} {...field('accommodation_type')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Inclusions <span className="font-normal opacity-60">(comma-separated)</span></label>
          <input className={inputCls} style={inputStyle} {...field('inclusions')} />
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand-crimson)' }}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </section>
  )
}
