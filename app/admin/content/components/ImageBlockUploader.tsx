'use client'

import { useRef, useState } from 'react'

type Props = {
  url: string
  caption: { en: string; bg: string }
  onChange: (patch: { url?: string; caption?: { en: string; bg: string } }) => void
}

export function ImageBlockUploader({ url, caption, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string>(url)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function uploadFile(file: File) {
    setError(null)
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setProgress(0)

    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setProgress(null)
      if (xhr.status >= 200 && xhr.status < 300) {
        const { url: uploadedUrl } = JSON.parse(xhr.responseText) as { url: string }
        // Revoke the blob URL now that we have the real URL
        URL.revokeObjectURL(localUrl)
        setPreview(uploadedUrl)
        onChange({ url: uploadedUrl })
      } else {
        let msg = 'Upload failed'
        try { msg = (JSON.parse(xhr.responseText) as { error: string }).error } catch { /* ignore */ }
        setError(msg)
        // Revert preview to last saved URL
        setPreview(url)
        URL.revokeObjectURL(localUrl)
      }
    }
    xhr.onerror = () => {
      setProgress(null)
      setError('Network error — upload failed')
      setPreview(url)
      URL.revokeObjectURL(localUrl)
    }

    const fd = new FormData()
    fd.append('file', file)
    xhr.open('POST', '/api/admin/guides/upload?type=image')
    xhr.send(fd)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) uploadFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  const hasImage = !!preview

  return (
    <div className="space-y-3">
      {/* Upload zone / preview */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          border: dragOver
            ? '2px dashed var(--brand-crimson)'
            : hasImage
            ? 'none'
            : '2px dashed var(--border-default)',
          minHeight: hasImage ? 'auto' : 120,
          backgroundColor: hasImage ? 'transparent' : 'var(--bg-card)',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {hasImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className="w-full rounded-xl"
              style={{ maxHeight: 320, objectFit: 'cover', display: 'block' }}
            />

            {/* Progress bar */}
            {progress !== null && (
              <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: 'var(--border-default)' }}>
                <div
                  className="h-full transition-all duration-100"
                  style={{ width: `${progress}%`, backgroundColor: 'var(--brand-crimson)' }}
                />
              </div>
            )}

            {/* Replace pill — bottom right */}
            {progress === null && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                Replace
              </button>
            )}
          </>
        ) : (
          /* Empty drop zone */
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-2 py-8 transition-colors hover:bg-black/[0.03]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium">
              {dragOver ? 'Drop image here' : 'Click to upload or drag & drop'}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>PNG, JPG, WEBP</span>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
          style={{ backgroundColor: 'rgba(188,71,73,0.08)', border: '1px solid rgba(188,71,73,0.2)' }}>
          <span className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); inputRef.current?.click() }}
            className="text-xs font-semibold flex-shrink-0"
            style={{ color: 'var(--brand-crimson)' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Captions — only shown once an image is present */}
      {hasImage && (
        <div className="grid grid-cols-2 gap-3">
          {(['en', 'bg'] as const).map(lang => (
            <div key={lang}>
              <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block"
                style={{ color: 'var(--text-secondary)' }}
              >
                Caption ({lang.toUpperCase()})
              </label>
              <input
                value={caption[lang]}
                onChange={e => onChange({ caption: { ...caption, [lang]: e.target.value } })}
                placeholder="Optional caption"
                className="w-full border rounded-xl px-3 py-2 text-sm"
                style={{
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-card)',
                }}
              />
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}
