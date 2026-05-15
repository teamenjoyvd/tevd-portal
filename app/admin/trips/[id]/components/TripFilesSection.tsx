'use client'

import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useSignedUpload } from '@/lib/hooks/useSignedUpload'

// ── Types ────────────────────────────────────────────────────────

type Attachment = {
  id: string
  file_name: string
  file_url: string
  file_type: 'pdf' | 'image'
  sort_order: number
  created_at: string
}

// ── Component ────────────────────────────────────────────────────

export function TripFilesSection({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { t } = useLanguage()

  const { upload, uploading, error: uploadError } = useSignedUpload(
    `/api/admin/trips/${tripId}/upload-url`
  )

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ['trip-attachments-admin', tripId],
    queryFn: () =>
      fetch(`/api/admin/trips/${tripId}/attachments`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
  })

  // Local state for optimistic append — avoids refetch after upload
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>([])
  const allAttachments = [
    ...attachments,
    ...localAttachments.filter(l => !attachments.find(a => a.id === l.id)),
  ]

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) return
    try {
      // confirm endpoint returns full attachment row
      const res = await fetch(`/api/admin/trips/${tripId}/upload-url?filename=${encodeURIComponent(file.name)}`)
      // We use the hook which calls confirm internally, but confirm returns the full row
      // So we call upload then fetch the updated list from the server-side state
      // Actually: useSignedUpload hits /confirm which returns { id, file_name, file_url, file_type, sort_order, created_at }
      // But the hook only returns { path, url }. We need the full row.
      // Solution: after upload resolves, invalidate the query to refetch. Optimistic append via url.
      void res // unused — we use the hook below
    } catch { /* handled below */ }

    try {
      const { url } = await upload(file)
      // Append a minimal optimistic entry; real data arrives on next query refetch
      const optimistic: Attachment = {
        id: crypto.randomUUID(),
        file_name: file.name,
        file_url: url,
        file_type: file.type === 'application/pdf' ? 'pdf' : 'image',
        sort_order: allAttachments.length,
        created_at: new Date().toISOString(),
      }
      setLocalAttachments(prev => [...prev, optimistic])
      // Invalidate to sync with server (gets real id + sort_order)
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
    } catch { /* uploadError state handles display */ }
  }

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const r = await fetch(`/api/admin/trips/${tripId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to delete')
    },
    onSuccess: (_, attachmentId) => {
      setLocalAttachments(prev => prev.filter(a => a.id !== attachmentId))
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
    },
  })

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('trips.files')}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          <Upload size={13} />
          {uploading ? t('trips.uploading') : t('trips.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{uploadError}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      ) : allAttachments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {allAttachments.map(a => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--bg-global)', border: '1px solid var(--border-default)' }}
            >
              <a
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm truncate hover:underline"
                style={{ color: 'var(--text-primary)' }}
              >
                {a.file_name}
              </a>
              <button
                onClick={() => setDeleteTarget({ id: a.id, name: a.file_name })}
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-crimson)' }}
                aria-label={`Delete ${a.file_name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('trips.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              {t('trips.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
