'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/apiClient'
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
import { t } from '@/lib/i18n'

type TripAttachment = {
  id: string
  file_url: string
  file_name: string
  file_type: 'pdf' | 'image'
  sort_order: number
  created_at: string
}

export function AttachmentsSection({ tripId }: { tripId: string }) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TripAttachment | null>(null)

  const { data: attachments = [], isLoading } = useQuery<TripAttachment[]>({
    queryKey: ['trip-attachments-admin', tripId],
    queryFn: () => apiClient<TripAttachment[]>(`/api/admin/trips/${tripId}/attachments`),
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await apiClient(`/api/admin/trips/${tripId}/attachments`, { method: 'POST', body: fd })
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
      apiClient(`/api/admin/trips/${tripId}/attachments/${attachment.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>
        {t('admin.operations.form.documents', 'en')}
      </p>

      {isLoading ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.loading', 'en')}</p>
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
                {t('admin.operations.form.btn.remove', 'en')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.noDocuments', 'en')}</p>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <span
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {uploading ? t('admin.operations.form.btn.uploading', 'en') : t('admin.operations.form.btn.upload', 'en')}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('admin.operations.form.uploadHint', 'en')}</span>
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
            <AlertDialogTitle>{t('admin.operations.form.dialog.title', 'en')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.operations.form.dialog.removeConfirm', 'en').replace('{{name}}', deleteTarget?.file_name ?? '')} {t('admin.operations.form.dialog.body', 'en')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.operations.form.dialog.cancel', 'en')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget) }}>
              {t('admin.operations.form.dialog.confirm', 'en')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
