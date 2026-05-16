'use client'

import { useRef, useState, useCallback } from 'react'
import { useSignedUpload } from '@/lib/hooks/useSignedUpload'
import { Trash2, Upload, ImageIcon, RefreshCw } from 'lucide-react'
import { sampleImageRegion } from '@/lib/color'
import { FALLBACK_ACCENT } from '@/app/(dashboard)/trips/[id]/components/shared'
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

const REGIONS = [
  'bottom-left',
  'bottom-right',
  'center',
  'top-left',
  'top-right',
] as const

type Region = typeof REGIONS[number]

export function TripHeroSection({
  tripId,
  initialImageUrl,
  initialCounterColor,
}: {
  tripId: string
  initialImageUrl: string | null
  initialCounterColor: string | null
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // colour state
  const [candidate, setCandidate] = useState<string>(initialCounterColor ?? FALLBACK_ACCENT)
  const [saved, setSaved] = useState<string | null>(initialCounterColor)
  const [regionIndex, setRegionIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const { upload, uploading, error: uploadError } = useSignedUpload(
    `/api/admin/trips/${tripId}/upload-url/hero`
  )

  // Run canvas sampling on a given region
  const sampleRegion = useCallback((region: Region) => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || !img.complete || img.naturalWidth === 0) return
    const result = sampleImageRegion(img, canvas, region)
    if (result) setCandidate(result)
  }, [])

  function handleImageLoad() {
    // Auto-sample on load using current region
    sampleRegion(REGIONS[regionIndex])
  }

  function handleRegenerate() {
    const next = (regionIndex + 1) % REGIONS.length
    setRegionIndex(next)
    sampleRegion(REGIONS[next])
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_bg_color: candidate }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(candidate)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch(`/api/admin/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counter_bg_color: null }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setSaved(null)
      setCandidate(FALLBACK_ACCENT)
      setRegionIndex(0)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const { url } = await upload(file)
      setImageUrl(url)
      // Reset colour candidate on new image upload
      setRegionIndex(0)
      setCandidate(FALLBACK_ACCENT)
    } catch { /* uploadError state handles display */ }
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      const r = await fetch(`/api/admin/trips/${tripId}/hero`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error)
      setImageUrl(null)
      setCandidate(FALLBACK_ACCENT)
      setRegionIndex(0)
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeleteOpen(false)
    }
  }

  const isDirty = candidate !== (saved ?? FALLBACK_ACCENT)

  return (
    <section
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      {/* Hidden canvas for pixel sampling */}
      <canvas ref={canvasRef} style={{ display: 'none' }} aria-hidden="true" />

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
          ref={imgRef}
          src={imageUrl}
          alt="Trip hero"
          crossOrigin="anonymous"
          className="w-full rounded-xl object-cover"
          style={{ maxHeight: 200 }}
          onLoad={handleImageLoad}
          onError={() => { /* silent — image still displayed, colour falls back */ }}
        />
      ) : (
        <div
          className="w-full rounded-xl flex items-center justify-center"
          style={{ height: 120, backgroundColor: 'var(--bg-global)', border: '1px dashed var(--border-default)' }}
        >
          <ImageIcon size={28} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
        </div>
      )}

      {/* Counter colour controls — always shown */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Counter colour
          </p>
          {saved !== null && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="text-xs hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              Reset to auto
            </button>
          )}
        </div>

        {/* Preview strip */}
        <div
          className="w-full rounded-lg px-4 py-3 flex items-baseline gap-2"
          style={{ backgroundColor: candidate }}
        >
          <span
            className="font-display font-bold leading-none"
            style={{ fontSize: 'clamp(1.5rem, 6vw, 2rem)', color: '#fff' }}
          >
            42
          </span>
          <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
            days to go
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Native colour input */}
          <label
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: candidate, border: '1px solid rgba(0,0,0,0.15)' }}
            />
            Custom
            <input
              type="color"
              value={candidate}
              onChange={e => setCandidate(e.target.value)}
              className="sr-only"
            />
          </label>

          {/* Regenerate — only when image present */}
          {imageUrl && (
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity flex-shrink-0"
              style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <RefreshCw size={11} />
              Regenerate
            </button>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: 'var(--brand-forest)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {saveError && (
          <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{saveError}</p>
        )}
      </div>

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
