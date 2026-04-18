'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ['trip-attachments-admin', tripId],
    queryFn: () =>
      fetch(`/api/admin/trips/${tripId}/attachments`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/admin/trips/${tripId}/attachments`, {
        method: 'POST',
        body: fd,
      })
      if (!r.ok) throw new Error((await r.json()).error)
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] })
      setUploadError(null)
    },
    onError: (e: Error) => setUploadError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      fetch(`/api/admin/trips/${tripId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip-attachments-admin', tripId] }),
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File exceeds 10 MB limit')
      return
    }
    setUploadError(null)
    uploadMutation.mutate(file)
  }

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Files
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          <Upload size={13} />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
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
      ) : attachments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map(a => (
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
