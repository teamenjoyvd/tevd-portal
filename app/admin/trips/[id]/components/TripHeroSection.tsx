'use client'

import { useState } from 'react'
import { useSignedUpload } from '@/lib/hooks/useSignedUpload'
import { Trash2, Upload, ImageIcon } from 'lucide-react'
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

export function TripHeroSection({
  tripId,
  initialImageUrl,
}: {
  tripId: string
  initialImageUrl: string | null
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { upload, uploading, error: uploadError } = useSignedUpload(
    `/api/admin/trips/${tripId}/upload-url/hero`
  )

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const { url } = await upload(file)
      setImageUrl(url)
    } catch { /* uploadError state handles display */ }
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      const r = await fetch(`/api/admin/trips/${tripId}/hero`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error)
      setImageUrl(null)
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeleteOpen(false)
    }
  }

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Hero Image
        </h2>
        <div className="flex items-center gap-2">
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer hover:opacity-90 transition-opacity"
            style={{ backgroundColor: uploading ? 'rgba(0,0,0,0.3)' : 'var(--brand-crimson)', pointerEvents: uploading ? 'none' : 'auto' }}
          >
            <Upload size={13} />
            {uploading ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          {imageUrl && (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: 'var(--brand-crimson)', border: '1px solid var(--border-default)' }}
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{uploadError}</p>
      )}
      {deleteError && (
        <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{deleteError}</p>
      )}

      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt="Trip hero"
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: 200 }}
        />
      ) : (
        <div
          className="w-full rounded-xl flex items-center justify-center"
          style={{ height: 120, backgroundColor: 'var(--bg-global)', border: '1px dashed var(--border-default)' }}
        >
          <ImageIcon size={28} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove hero image?</AlertDialogTitle>
            <AlertDialogDescription>The image will be permanently deleted from storage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
