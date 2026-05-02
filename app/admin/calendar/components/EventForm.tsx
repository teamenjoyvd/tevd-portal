'use client'

import { useState } from 'react'
import { fromSofiaLocalInput } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'

export const ALL_ROLES = ['guest', 'member', 'core', 'admin']
export const CATEGORIES = ['N21', 'Personal'] as const
export const EVENT_TYPES = ['in-person', 'online', 'hybrid'] as const
export const DEFAULT_AVAILABLE_ROLES = ['HOST', 'SPEAKER', 'PRODUCTS']

export type EventFormState = {
  title: string
  description: string
  start_time: string
  end_time: string
  week_number: number
  category: 'N21' | 'Personal'
  event_type: 'in-person' | 'online' | 'hybrid' | null
  access_roles: string[]
  meeting_url: string
  allow_guest_registration: boolean
  available_roles: string[]
}

export function emptyForm(): EventFormState {
  return {
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    week_number: 0,
    category: 'N21',
    event_type: null,
    access_roles: [...ALL_ROLES],
    meeting_url: '',
    allow_guest_registration: true,
    available_roles: [...DEFAULT_AVAILABLE_ROLES],
  }
}

/**
 * Convert form time fields (Sofia local "datetime-local" strings) to UTC ISO
 * before API submission. All other fields pass through unchanged.
 */
export function normalizeFormTimes(f: EventFormState): EventFormState {
  return {
    ...f,
    start_time: f.start_time ? fromSofiaLocalInput(f.start_time) : f.start_time,
    end_time:   f.end_time   ? fromSofiaLocalInput(f.end_time)   : f.end_time,
  }
}

// ── EventForm hoisted to module scope to prevent remount on parent render ──

export function EventForm({
  f,
  setF,
  onSave,
  onCancel,
  isPending,
  label,
  formError,
}: {
  f: EventFormState
  setF: React.Dispatch<React.SetStateAction<EventFormState>>
  onSave: () => void
  onCancel: () => void
  isPending: boolean
  label: string
  formError: string | null
}) {
  const { t } = useLanguage()
  const [roleInput, setRoleInput] = useState('')

  function addRole() {
    const role = roleInput.trim().toUpperCase()
    if (role && !f.available_roles.includes(role)) {
      setF(p => ({ ...p, available_roles: [...p.available_roles, role] }))
    }
    setRoleInput('')
  }

  function removeRole(role: string) {
    setF(p => ({ ...p, available_roles: p.available_roles.filter(r => r !== role) }))
  }

  return (
    <div className="space-y-4">
      <input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))}
        placeholder={t('admin.calendar.placeholder.title')} className="w-full border rounded-xl px-3 py-2.5 text-sm"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      <textarea value={f.description ?? ''} onChange={e => setF(p => ({ ...p, description: e.target.value }))}
        placeholder={t('admin.calendar.placeholder.description')} rows={2}
        className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.start')}</label>
          <input type="datetime-local" value={f.start_time}
            onChange={e => setF(p => ({ ...p, start_time: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.end')}</label>
          <input type="datetime-local" value={f.end_time}
            onChange={e => setF(p => ({ ...p, end_time: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>

      {/* Meeting URL */}
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.meetingUrl')}</label>
        <input type="url" value={f.meeting_url} onChange={e => setF(p => ({ ...p, meeting_url: e.target.value }))}
          placeholder={t('admin.calendar.placeholder.meetingUrl')}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.category')}</label>
          <div className="flex gap-2">
            {CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => setF(p => ({ ...p, category: c }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.category === c ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: f.category === c ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.type')}</label>
          <div className="flex gap-2">
            {EVENT_TYPES.map(t2 => (
              <button key={t2} type="button" onClick={() => setF(p => ({ ...p, event_type: f.event_type === t2 ? null : t2 }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.event_type === t2 ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)', color: f.event_type === t2 ? 'white' : 'var(--text-secondary)' }}>
                {t2}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.visibleTo')}</label>
          <div className="flex gap-2">
            {ALL_ROLES.map(role => (
              <button key={role} type="button" onClick={() => setF(p => ({
                ...p,
                access_roles: p.access_roles.includes(role)
                  ? p.access_roles.filter(r => r !== role)
                  : [...p.access_roles, role],
              }))}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: f.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: f.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Allow guest registration toggle */}
      <div>
        <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.allowGuestReg')}</label>
        <button
          type="button"
          onClick={() => setF(p => ({ ...p, allow_guest_registration: !p.allow_guest_registration }))}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            backgroundColor: f.allow_guest_registration ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)',
            color: f.allow_guest_registration ? 'white' : 'var(--text-secondary)',
          }}>
          {f.allow_guest_registration ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Available roles tag manager */}
      <div>
        <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.calendar.lbl.availableRoles')}</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {f.available_roles.map(role => (
            <span key={role} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}>
              {role}
              <button type="button" onClick={() => removeRole(role)}
                className="ml-0.5 leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-parchment)' }}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={roleInput}
            onChange={e => setRoleInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
            placeholder={t('admin.calendar.placeholder.roleTag')}
            className="flex-1 border rounded-xl px-3 py-2 text-xs"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <button type="button" onClick={addRole}
            className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            +
          </button>
        </div>
      </div>

      {formError && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{formError}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={isPending || !f.title || !f.start_time || !f.end_time}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? t('admin.calendar.btn.saving') : label}
        </button>
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('admin.calendar.btn.cancel')}
        </button>
      </div>
    </div>
  )
}
