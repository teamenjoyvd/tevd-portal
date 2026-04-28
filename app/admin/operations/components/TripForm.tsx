'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { ALL_ROLES, type Milestone, type Trip } from './operations-types'
import { AttachmentsSection } from './AttachmentsSection'
import { t } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────

export type TripFormState = Omit<Trip, 'id' | 'currency'>

export type MilestoneInputState = { label: string; amount: string; due_date: string }

// ── TripForm ─────────────────────────────────────────────────────

export function TripForm({
  form,
  setForm,
  milestoneInput,
  setMilestoneInput,
  error,
  isPending,
  isValid,
  editing,
  onSave,
  onClose,
}: {
  form: TripFormState
  setForm: React.Dispatch<React.SetStateAction<TripFormState>>
  milestoneInput: MilestoneInputState
  setMilestoneInput: React.Dispatch<React.SetStateAction<MilestoneInputState>>
  error: string | null
  isPending: boolean
  isValid: boolean
  editing: Trip | null
  onSave: () => void
  onClose: () => void
}): React.JSX.Element {
  function addMilestone() {
    if (!milestoneInput.label || !milestoneInput.amount || !milestoneInput.due_date) return
    setForm(f => ({
      ...f,
      milestones: [...f.milestones, {
        label: milestoneInput.label,
        amount: Number(milestoneInput.amount),
        due_date: milestoneInput.due_date,
      } satisfies Milestone],
    }))
    setMilestoneInput({ label: '', amount: '', due_date: '' })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {(['title', 'destination'] as const).map(k => (
          <div key={k}>
            <label className="text-xs mb-1 block capitalize" style={{ color: 'var(--text-secondary)' }}>{k}</label>
            <input
              value={(form as Record<string, unknown>)[k] as string}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.description', 'en')}</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.startDate', 'en')}</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.endDate', 'en')}</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.cost', 'en')}</label>
          <input type="number" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.milestones', 'en')}</p>
        {form.milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(m.amount, 'EUR')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{m.due_date}</span>
            <button onClick={() => setForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))}
              className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{t('admin.operations.form.btn.remove', 'en')}</button>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <input placeholder={t('admin.operations.form.placeholder.label', 'en')} value={milestoneInput.label}
            onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm col-span-1" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <input placeholder={t('admin.operations.form.placeholder.amount', 'en')} type="number" value={milestoneInput.amount}
            onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <input type="date" value={milestoneInput.due_date}
            onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <button onClick={addMilestone}
            className="border rounded-xl text-sm hover:bg-black/5 transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>{t('admin.operations.form.btn.addMilestone', 'en')}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.location', 'en')}</label>
          <input value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
            placeholder="e.g. Oradea, Romania" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.tripType', 'en')}</label>
          <input value={form.trip_type ?? ''} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value || null }))}
            placeholder="e.g. leisure, training" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.accommodation', 'en')}</label>
          <input value={form.accommodation_type ?? ''} onChange={e => setForm(f => ({ ...f, accommodation_type: e.target.value || null }))}
            placeholder="e.g. hotel, hostel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.inclusions', 'en')}</label>
          <input value={form.inclusions.join(', ')} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
            placeholder="e.g. flights, hotel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.visibleTo', 'en')}</p>
        <div className="flex gap-2 flex-wrap">
          {ALL_ROLES.map(role => (
            <button key={role} onClick={() => setForm(f => ({
              ...f,
              visibility_roles: f.visibility_roles.includes(role)
                ? f.visibility_roles.filter(r => r !== role)
                : [...f.visibility_roles, role],
            }))}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: form.visibility_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                color: form.visibility_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
              }}>
              {role}
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <AttachmentsSection tripId={editing.id} />
        </div>
      )}

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onSave} disabled={isPending || !isValid}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? t('admin.operations.form.btn.saving', 'en') : editing ? t('admin.operations.form.btn.saveChanges', 'en') : t('admin.operations.form.btn.createTrip', 'en')}
        </button>
        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>{t('admin.operations.form.btn.cancel', 'en')}</button>
      </div>
    </div>
  )
}
