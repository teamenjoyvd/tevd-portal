'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Image, File, GripVertical, Trash2 } from 'lucide-react'
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
import { makeDragHandlers } from '@/app/admin/content/components/useDragSort'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Attachment = {
  id: string
  file_url: string
  file_name: string
  label: string | null
  file_type: 'pdf' | 'image' | 'other'
  sort_order: number
  created_at: string
}

function FileIcon({ type }: { type: Attachment['file_type'] }) {
  if (type === 'pdf')   return <FileText size={16} style={{ color: 'var(--brand-crimson)', flexShrink: 0 }} />
  if (type === 'image') return <Image    size={16} style={{ color: 'var(--brand-teal)',    flexShrink: 0 }} />
  return                       <File     size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
}

export function GuideAttachmentsPanel({ guideId }: { guideId: string }) {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const [dragging, setDragging]         = useState<string | null>(null)
  const [local, setLocal]               = useState<Attachment[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null)
  const [labelEdits, setLabelEdits]     = useState<Record<string, string>>({})

  const queryKey = ['guide-attachments', guideId]

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey,
    queryFn: () =>
      fetch(`/api/admin/guides/${guideId}/attachments`).then(r => r.json()),
  })

  useEffect(() => {
    if (attachments.length > 0) setLocal(attachments)
  }, [attachments])

  const reorderMut = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch(`/api/admin/guides/${guideId}/attachments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/guides/${guideId}/attachments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey })
    },
  })

  const labelMut = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      fetch(`/api/admin/guides/${guideId}/attachments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const dragHandlers = makeDragHandlers(
    dragging,
    setDragging,
    local,
    setLocal,
    (items) => reorderMut.mutate(items),
  )

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/guides/${guideId}/attachments`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const json = await res.json()
        setUploadError(json.error ?? 'Upload failed')
      } else {
        qc.invalidateQueries({ queryKey })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const displayList = local.length > 0 ? local : attachments

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.content.guides.attachments.title')}
        </p>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-black/5 disabled:opacity-40"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {uploading
              ? t('admin.content.guides.attachments.uploading')
              : t('admin.content.guides.attachments.upload')}
          </button>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{uploadError}</p>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }} />
          ))}
        </div>
      )}

      {!isLoading && displayList.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.content.guides.attachments.empty')}
        </p>
      )}

      {!isLoading && displayList.length > 0 && (
        <div className="space-y-1.5">
          {displayList.map(att => (
            <div
              key={att.id}
              draggable
              onDragStart={() => dragHandlers.onDragStart(att.id)}
              onDragOver={e => dragHandlers.onDragOver(e, att.id)}
              onDrop={dragHandlers.onDrop}
              onDragEnd={dragHandlers.onDragEnd}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border"
              style={{
                borderColor: 'var(--border-default)',
                backgroundColor: dragHandlers.isDragging(att.id)
                  ? 'rgba(0,0,0,0.04)'
                  : 'var(--bg-card)',
                opacity: dragHandlers.isDragging(att.id) ? 0.5 : 1,
              }}
            >
              <GripVertical size={14} style={{ color: 'var(--text-secondary)', cursor: 'grab', flexShrink: 0 }} />
              <FileIcon type={att.file_type} />
              <input
                className="flex-1 text-xs bg-transparent border-none outline-none min-w-0"
                style={{ color: 'var(--text-primary)' }}
                value={labelEdits[att.id] ?? (att.label ?? att.file_name)}
                placeholder={t('admin.content.guides.attachments.labelPlaceholder')}
                onChange={e => setLabelEdits(prev => ({ ...prev, [att.id]: e.target.value }))}
                onBlur={() => {
                  const val = labelEdits[att.id]
                  if (val !== undefined && val !== (att.label ?? att.file_name)) {
                    labelMut.mutate({ id: att.id, label: val })
                  }
                }}
              />
              <button
                onClick={() => setDeleteTarget(att)}
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Delete attachment"
              >
                <Trash2 size={14} style={{ color: 'var(--brand-crimson)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.guides.attachments.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.content.guides.attachments.deleteConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.content.guides.attachments.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}
            >
              {t('admin.content.guides.attachments.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
