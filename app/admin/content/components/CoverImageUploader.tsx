'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'

export function CoverImageUploader({
  value,
  onChange,
  onUploading,
}: {
  value: string | null
  onChange: (url: string | null) => void
  onUploading?: (uploading: boolean) => void
}): React.JSX.Element {
  const { t } = useLanguage()
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileUpload(file: File) {
    setCoverFile(file)
    setUploading(true)
    onUploading?.(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/guides/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json() as { url: string }
      onChange(url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setUploading(false)
      onUploading?.(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-black/5 transition-colors flex-shrink-0"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
          </svg>
          {uploading ? t('admin.content.guides.btn.uploading') : t('admin.content.guides.btn.upload')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
        </label>
        {coverFile && !uploading && (
          <span className="text-[11px] truncate max-w-[120px]" style={{ color: 'var(--brand-teal)' }}>
            {coverFile.name}
          </span>
        )}
      </div>
      <input
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        placeholder={t('admin.content.guides.placeholder.pasteUrl')}
        className="w-full border rounded-xl px-3 py-2 text-xs"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="rounded-lg object-cover" style={{ width: '100%', height: 80 }} />
      )}
    </div>
  )
}
