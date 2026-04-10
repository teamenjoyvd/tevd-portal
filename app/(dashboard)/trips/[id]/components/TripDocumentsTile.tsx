'use client'

import { useQuery } from '@tanstack/react-query'

interface Attachment {
  id: string
  file_url: string
  file_name: string
  file_type: 'pdf' | 'image'
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
      <polyline points="9 9 10 9" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

export function TripDocumentsTile({ tripId }: { tripId: string }) {
  const { data: attachments, isLoading, isError } = useQuery<Attachment[]>({
    queryKey: ['trip-attachments', tripId],
    queryFn: () =>
      fetch(`/api/trips/${tripId}/attachments`).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed')
        return r.json()
      }),
  })

  if (isLoading) return null

  if (isError) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        <div className="px-6 py-5">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Trip Documents
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Documents could not be loaded.
          </p>
        </div>
      </div>
    )
  }

  if (!attachments || attachments.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <div className="px-6 pt-5 pb-2">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-secondary)' }}
        >
          Trip Documents
        </p>
      </div>
      <div className="px-6 pb-5">
        <div className="space-y-1 mt-1">
          {attachments.map(a => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {a.file_type === 'pdf' ? <PdfIcon /> : <ImageIcon />}
                </span>
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {a.file_name}
                </p>
              </div>
              <a
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex-shrink-0 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--brand-teal)' }}
              >
                Open ↗
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
