'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/format'
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
import { ALL_ROLES, type Milestone, type Trip } from './TripsTab'
import { useTranslation } from '@/lib/i18n/useTranslation'

// ── Types ────────────────────────────────────────────────────────

type TripAttachment = {
  id: string
  file_url: string
  file_name: string
  file_type: 'pdf' | 'image'
  sort_order: number
  created_at: string
}

export type TripFormState = Omit<Trip, 'id' | 'currency'>

export type MilestoneInputState = { label: string; amount: string; due_date: string }

// ── AttachmentsSection ───────────────────────────────────────────

function AttachmentsSection({ tripId }: { tripId: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TripAttachment | null>(null)

  const { data: attachments = [], isLoading } = useQuery<TripAttachment[]>({
    queryKey: ['trip-attachments-admin', tripId],
    queryFn: () =>
      fetch(`/api/admin/trips/${tripId}/attachments`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load')
        return r.json()
      }),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/trips/${tripId}/attachments`, { method: 'POST', body: fd })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Upload failed')
      }
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (attachment: TripAttachment) =>
      fetch(`/api/admin/trips/${tripId}/attachments/${attachment.id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok && r.status !== 204) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.operations.form.documents')}
      </p>

      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.loading')}</p>
      ) : attachments.length > 0 ? (
        <div className="rounded-xl border mb-3 overflow-hidden" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}>
          {attachments.map((a, i) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? '1px solid var(--border-default)' : 'none' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: a.file_type === 'pdf' ? 'rgba(188,71,73,0.12)' : 'rgba(62,119,133,0.12)',
                    color: a.file_type === 'pdf' ? 'var(--brand-crimson)' : 'var(--brand-teal)',
                  }}
                >
                  {a.file_type.toUpperCase()}
                </span>
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm truncate hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {a.file_name}
                </a>
              </div>
              <button
                onClick={() => setDeleteTarget(a)}
                className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-crimson)' }}
              >
                {t('admin.operations.form.btn.remove')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.noDocuments')}</p>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <span
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {uploading ? t('admin.operations.form.btn.uploading') : t('admin.operations.form.btn.upload')}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.uploadHint')}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      {uploadError && (
        <p className="text-xs mt-2" style={{ color: 'var(--brand-crimson)' }}>{uploadError}</p>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.operations.form.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &ldquo;{deleteTarget?.file_name}&rdquo;? {t('admin.operations.form.dialog.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.operations.form.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}
            >
              {t('admin.operations.form.dialog.confirm')}
            </AlertDialogAction>
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
  const { t } = useTranslation()

  function addMilestone() {
    if (!milestoneInput.label || !milestoneInput.amount || !milestoneInput.due_date) return
    setForm(f => ({
      ...f,
      milestones: [...f.milestones, {
        label: milestoneInput.label,
        amount: Number(milestoneInput.amount),
        due_date: milestoneInput.due_date,
      }],
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
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.description')}</label>
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
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.startDate')}</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.endDate')}</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.cost')}</label>
          <input type="number" value={form.total_cost} onChange={e => setForm(f => ({ ...f, total_cost: Number(e.target.value) }))}
            className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.milestones')}</p>
        {form.milestones.map((m, i) => (
          <div key={i} className="flex items-center gap-3 text-sm mb-2 py-2 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <span className="flex-1 font-medium" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(m.amount, 'EUR')}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{m.due_date}</span>
            <button onClick={() => setForm(f => ({ ...f, milestones: f.milestones.filter((_, idx) => idx !== i) }))}
              className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{t('admin.operations.form.btn.remove')}</button>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <input placeholder={t('admin.operations.form.placeholder.label')} value={milestoneInput.label}
            onChange={e => setMilestoneInput(m => ({ ...m, label: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm col-span-1" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <input placeholder={t('admin.operations.form.placeholder.amount')} type="number" value={milestoneInput.amount}
            onChange={e => setMilestoneInput(m => ({ ...m, amount: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <input type="date" value={milestoneInput.due_date}
            onChange={e => setMilestoneInput(m => ({ ...m, due_date: e.target.value }))}
            className="border rounded-xl px-3 py-2 text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          <button onClick={addMilestone}
            className="border rounded-xl text-sm hover:bg-black/5 transition-colors" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>{t('admin.operations.form.btn.addMilestone')}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.location')}</label>
          <input value={form.location ?? ''} onChange={e => setForm(f => ({ ...f, location: e.target.value || null }))}
            placeholder="e.g. Oradea, Romania" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.tripType')}</label>
          <input value={form.trip_type ?? ''} onChange={e => setForm(f => ({ ...f, trip_type: e.target.value || null }))}
            placeholder="e.g. leisure, training" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.accommodation')}</label>
          <input value={form.accommodation_type ?? ''} onChange={e => setForm(f => ({ ...f, accommodation_type: e.target.value || null }))}
            placeholder="e.g. hotel, hostel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.inclusions')}</label>
          <input value={form.inclusions.join(', ')} onChange={e => setForm(f => ({ ...f, inclusions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
            placeholder="e.g. flights, hotel" className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.lbl.visibleTo')}</p>
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
          {isPending ? t('admin.operations.form.btn.saving') : editing ? t('admin.operations.form.btn.saveChanges') : t('admin.operations.form.btn.createTrip')}
        </button>
        <button onClick={onClose}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>{t('admin.operations.form.btn.cancel')}</button>
      </div>
    </div>
  )
}
