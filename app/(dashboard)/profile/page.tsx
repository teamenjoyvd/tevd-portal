'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

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
  const diffDays = (new Date(validThrough).getTime() - Date.now()) / 86400000
  if (diffDays < 0)   return 'critical'
  if (diffDays < 90)  return 'critical'
  if (diffDays < 180) return 'warning'
  return 'ok'
}

const EXPIRY_STYLES = {
  ok:       'bg-[#81b29a]/10 border-[#81b29a]/30 text-[#2d6a4f]',
  warning:  'bg-[#f2cc8f]/20 border-[#f2cc8f] text-[#7a5c00]',
  critical: 'bg-[#bc4749]/10 border-[#bc4749]/40 text-[#bc4749]',
}

const EXPIRY_LABELS = {
  ok:       'Valid',
  warning:  'Expiring soon — update within 6 months',
  critical: 'Expired or expiring very soon — action required',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Profile>>({})
  const [saved, setSaved] = useState(false)

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => fetch('/api/profile').then(r => r.json()),
  })

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

  const activeDocType = form.document_active_type ?? profile?.document_active_type ?? 'id'
  const expiryState   = getExpiryState(form.valid_through ?? profile?.valid_through ?? null)

  return (
    <>
      <PageHeading title="My Profile" subtitle="Account details and travel documents" />
      <PageContainer>
        <div className="max-w-xl py-8 pb-16">

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl animate-pulse"
                  style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
              ))}
            </div>
          ) : !profile ? null : (
            <div className="space-y-4">

              {/* Identity */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
                <p className="text-xs font-semibold tracking-widest uppercase mb-4"
                  style={{ color: 'var(--stone)' }}>
                  Identity
                </p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                      First name
                    </label>
                    <input
                      value={form.first_name ?? ''}
                      onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--deep)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                      Last name
                    </label>
                    <input
                      value={form.last_name ?? ''}
                      onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--deep)' }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--stone)' }}>
                  <span>
                    ABO:{' '}
                    <span className="font-medium" style={{ color: 'var(--deep)' }}>
                      {profile.abo_number ?? '—'}
                    </span>
                  </span>
                  <span>
                    Role:{' '}
                    <span className="font-medium" style={{ color: 'var(--deep)' }}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </span>
                </div>
              </div>

              {/* Travel document */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-5">
                <p className="text-xs font-semibold tracking-widest uppercase mb-4"
                  style={{ color: 'var(--stone)' }}>
                  Travel document
                </p>
                <div className="flex gap-2 mb-5">
                  {(['id', 'passport'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => toggleDoc.mutate(type)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: activeDocType === type
                          ? 'var(--deep)'
                          : 'rgba(0,0,0,0.05)',
                        color: activeDocType === type ? 'white' : 'var(--stone)',
                      }}
                    >
                      {type === 'id' ? 'National ID' : 'Passport'}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                      {activeDocType === 'passport' ? 'Passport number' : 'ID number'}
                    </label>
                    <input
                      value={activeDocType === 'passport'
                        ? (form.passport_number ?? '')
                        : (form.id_number ?? '')}
                      onChange={e => setForm(f => ({
                        ...f,
                        [activeDocType === 'passport'
                          ? 'passport_number'
                          : 'id_number']: e.target.value,
                      }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm font-mono"
                      style={{ color: 'var(--deep)' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--stone)' }}>
                      Valid through
                    </label>
                    <input
                      type="date"
                      value={form.valid_through ?? ''}
                      onChange={e => setForm(f => ({ ...f, valid_through: e.target.value }))}
                      className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                      style={{ color: 'var(--deep)' }}
                    />
                  </div>
                  {expiryState && (
                    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${EXPIRY_STYLES[expiryState]}`}>
                      {EXPIRY_LABELS[expiryState]}
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
              </div>

              {/* Save */}
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="w-full py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ backgroundColor: 'var(--crimson)' }}
              >
                {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
              </button>

            </div>
          )}
        </div>
      </PageContainer>
    </>
  )
}