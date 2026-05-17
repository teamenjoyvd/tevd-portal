'use client'

import { useRef, useState } from 'react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import type { JSONContent } from '@tiptap/core'
import { FileText, Image as ImageIcon, File, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTiptapCopyButtons } from '@/lib/hooks/useTiptapCopyButtons'

type Attachment = {
  id: string
  file_url: string
  file_name: string
  label: string | null
  file_type: 'pdf' | 'image' | 'other'
  sort_order: number
}

const TIPTAP_EXTENSIONS = [StarterKit, Link, Image]

function AttachmentIcon({ type }: { type: Attachment['file_type'] }) {
  if (type === 'pdf')   return <FileText size={16} style={{ color: 'var(--brand-crimson)', flexShrink: 0 }} />
  if (type === 'image') return <ImageIcon size={16} style={{ color: 'var(--brand-teal)',    flexShrink: 0 }} />
  return                       <File     size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
}

export default function GuideBody({
  body,
  lang,
  attachments = [],
}: {
  body: JSONContent | null
  lang: string
  attachments?: Attachment[]
}) {
  const { t } = useLanguage()
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  const html = body ? generateHTML(body, TIPTAP_EXTENSIONS) : ''

  useTiptapCopyButtons(outputRef, [html])

  return (
    <>
      <div className="guide-body max-w-2xl">
        <div
          ref={outputRef}
          className="tiptap-output"
          // Content is generated server-side from admin-controlled JSONContent.
          // No user-submitted HTML reaches this path.
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Downloads section */}
        {attachments.length > 0 && (
          <div className="pt-4 space-y-3">
            <h2 className="font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('guides.downloads')}
            </h2>
            <div className="space-y-2">
              {attachments.map(att => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:bg-black/5"
                  style={{ borderColor: 'var(--border-default)', textDecoration: 'none' }}
                >
                  <AttachmentIcon type={att.file_type} />
                  <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {att.label ?? att.file_name}
                  </span>
                  <Download size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox — triggered programmatically if needed in future */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => { if (!open) setLightboxUrl(null) }}>
        <DialogOverlay style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} />
        <DialogContent
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent border-none shadow-none p-0 max-w-[90vw] flex flex-col items-center gap-3 [&>button]:text-white [&>button]:opacity-100 [&>button]:bg-black/40 [&>button]:rounded-full [&>button]:p-1"
          aria-label="Image lightbox"
        >
          {lightboxUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightboxUrl}
              alt=""
              className="rounded-xl max-w-full"
              style={{ maxHeight: '80vh', objectFit: 'contain', width: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
