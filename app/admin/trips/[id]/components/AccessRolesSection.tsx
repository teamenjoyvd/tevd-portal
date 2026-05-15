'use client'

import { useState } from 'react'
import { ALL_ROLES } from '@/lib/roles'
import type { MemberRole } from '@/lib/roles'

export function AccessRolesSection({
  tripId,
  initialRoles,
}: {
  tripId: string
  initialRoles: MemberRole[]
}) {
  const [roles, setRoles] = useState<MemberRole[]>(initialRoles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(role: MemberRole) {
    setRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const r = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_roles: roles }),
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

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Access Roles</h2>

      <div className="flex flex-wrap gap-2">
        {[...ALL_ROLES].map(role => {
          const active = roles.includes(role)
          return (
            <button
              key={role}
              onClick={() => toggle(role)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: active ? 'var(--text-primary)' : 'rgba(0,0,0,0.06)',
                color: active ? 'var(--bg-card)' : 'var(--text-secondary)',
              }}
            >
              {role}
            </button>
          )
        })}
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
