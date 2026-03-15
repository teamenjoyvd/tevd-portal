'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

type Profile = {
  id: string
  clerk_id: string
  first_name: string
  last_name: string
  abo_number: string | null
  role: 'admin' | 'core' | 'member' | 'guest'
  document_active_type: 'id' | 'passport'
  id_number: string | null
  passport_number: string | null
  valid_through: string | null
  display_names: Record<string, string>
  created_at: string
}

function getExpiryState(validThrough: string | null): 'ok' | 'warning' | 'critical' | null {
  if (!validThrough) return null
  const expiry = new Date(validThrough)
  const now = new Date()
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

const EXPIRY_STYLES = {
  ok:       'bg-[#81b29a]/10 border-[#81b29a]/30 text-[#81b29a]',
  warning:  'bg-[#f2cc8f]/20 border-[#f2cc8f] text-[#8e6a00]',
  critical: 'bg-[#bc4749]/10 border-[#bc4749]/40 text-[#bc4749]',
}

const EXPIRY_LABELS = {
  ok:       'Valid',
  warning:  'Expiring soon — update within 6 months',
  critical: 'Expired or expiring very soon — action required',
}

export default function ProfilePage() {
  const qc = useQueryClient()

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

  const [form, setForm] = useState<Partial<Profile>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setForm({
      first_name:           profile.first_name,
      last_name:            profile.last_name,
      document_active_type: profile.document_active_type,
      id_number:            profile.id_number ?? '',
      passport_number:      profile.passport_number ?? '',
      valid_through:        profile.valid_through ?? '',
    })
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Profile>) =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const toggleDoc = useMutation({
    mutationFn: (type: 'id' | 'passport') =>
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_active_type: type }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      setForm(f => ({ ...f, document_active_type: data.document_active_type }))
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!profile) return null

  const activeDocType = form.document_active_type ?? profile.document_active_type
  const activeDocNumber = activeDocType === 'passport'
    ? (form.passport_number ?? profile.passport_number)
    : (form.id_number ?? profile.id_number)

  const expiryState = getExpiryState(form.valid_through ?? profile.valid_through)
  const expiryStyle = expiryState ? EXPIRY_STYLES[expiryState] : null
  const expiryLabel = expiryState ? EXPIRY_LABELS[expiryState] : null

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Profile</h1>
      <p className="text-sm text-gray-500 mb-8">Your account details and travel documents.</p>

      {/* Identity */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Identity</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">First name</label>
            <input
              value={form.first_name ?? ''}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Last name</label>
            <input
              value={form.last_name ?? ''}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>ABO: <span className="text-gray-800 font-medium">{profile.abo_number ?? '—'}</span></span>
          <span>Role: <span className="text-gray-800 font-medium">{ROLE_LABELS[profile.role]}</span></span>
        </div>
      </section>

      {/* Travel document */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Travel document
        </h2>

        {/* Toggle */}
        <div className="flex gap-2 mb-5">
          {(['id', 'passport'] as const).map(type => (
            <button
              key={type}
              onClick={() => toggleDoc.mutate(type)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeDocType === type
                  ? 'bg-[#3d405b] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {type === 'id' ? 'National ID' : 'Passport'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {activeDocType === 'passport' ? 'Passport number' : 'ID number'}
            </label>
            <input
              value={activeDocType === 'passport'
                ? (form.passport_number ?? '')
                : (form.id_number ?? '')}
              onChange={e => setForm(f => ({
                ...f,
                [activeDocType === 'passport' ? 'passport_number' : 'id_number']: e.target.value,
              }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Valid through</label>
            <input
              type="date"
              value={form.valid_through ?? ''}
              onChange={e => setForm(f => ({ ...f, valid_through: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Expiry state badge */}
          {expiryStyle && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${expiryStyle}`}>
              {expiryLabel}
              {form.valid_through && (
                <span className="font-normal ml-1 opacity-70">
                  · {new Date(form.valid_through).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Save */}
      <button
        onClick={() => saveMutation.mutate(form)}
        disabled={saveMutation.isPending}
        className="w-full bg-[#bc4749] text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors hover:bg-[#a33d3f]"
      >
        {saveMutation.isPending ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </div>
  )
}