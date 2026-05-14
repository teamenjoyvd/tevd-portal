'use client'

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'
import { ALL_ROLES, type Milestone, type Trip } from './operations-types'
import { AttachmentsSection } from './AttachmentsSection'
import { t } from '@/lib/i18n'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

// ── Types ────────────────────────────────────────────────────────

export type TripFormState = Omit<Trip, 'id' | 'currency'>

export type MilestoneInputState = { label: string; amount: string; due_date: string }

// ── HeroImageField (module scope — never inside TripForm body) ───

function HeroImageField({
  tripId,
  currentImageUrl,
  onUploaded,
}: {
  tripId: string
  currentImageUrl: string | null
  onUploaded: (newUrl: string | null) => void
}) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentImageUrl)
  const [uploading, setUploading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/trips/${tripId}/hero`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const trip = await res.json()
      setPreview(trip.image_url)
      onUploaded(trip.image_url)
      qc.invalidateQueries({ queryKey: ['trips'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete() {
    setUploading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/trips/${tripId}/hero`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Delete failed')
      setPreview(null)
      onUploaded(null)
      qc.invalidateQueries({ queryKey: ['trips'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setUploading(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        Hero Image
      </p>

      {preview && (
        <div className="relative mb-3 rounded-xl overflow-hidden" style={{ height: 120 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" aria-hidden="true" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            disabled={uploading}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
            aria-label="Remove hero image"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-40"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
          {uploading ? 'Uploading…' : preview ? 'Replace image' : 'Upload image'}
        </button>
        {uploading && (
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={uploading}
        onChange={handleFileChange}
      />

      {error && <p className="text-xs mt-1" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <AlertDialog open={deleteOpen} onOpenChange={open => { if (!open) setDeleteOpen(false) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove hero image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the hero image for this trip.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

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
              access_roles: f.access_roles.includes(role)
                ? f.access_roles.filter(r => r !== role)
                : [...f.access_roles, role],
            }))}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: form.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                color: form.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
              }}>
              {role}
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <>
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-default)' }}>
            <AttachmentsSection tripId={editing.id} />
          </div>
          <HeroImageField
            tripId={editing.id}
            currentImageUrl={editing.image_url}
            onUploaded={url => setForm(f => ({ ...f, image_url: url }))}
          />
        </>
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
