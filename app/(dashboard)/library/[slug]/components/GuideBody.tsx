'use client'

import { useState } from 'react'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import BentoCard from '@/components/bento/BentoCard'
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog'

type TextBlock = {
  type: 'heading' | 'paragraph' | 'callout'
  content: { en: string; bg: string }
  emoji?: string
}

type ImageBlock = {
  type: 'image'
  url: string
  caption?: { en: string; bg: string }
}

type Block = TextBlock | ImageBlock

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: ['strong', 'em', 'code', 'del', 'u', 'br', 'p', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
  allowedSchemes: ['https', 'http'],
}

function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { async: false, breaks: true }) as string
  return sanitizeHtml(raw, SANITIZE_OPTS)
}

function getContent(block: TextBlock, lang: string): string {
  return (block.content as Record<string, string>)[lang] ?? block.content.en ?? ''
}

export default function GuideBody({
  blocks,
  lang,
}: {
  blocks: unknown[] | null
  lang: string
}) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  if (!blocks || blocks.length === 0) return null

  return (
    <>
      <div className="guide-body max-w-2xl space-y-6">
        {(blocks as Block[]).map((block, i) => {
          if (block.type === 'image') {
            if (!block.url) return null
            const caption = block.caption
              ? (block.caption as Record<string, string>)[lang] ?? block.caption.en ?? ''
              : ''
            return (
              <figure key={i}>
                <div
                  className="relative overflow-hidden rounded-2xl cursor-zoom-in group"
                  onClick={() => setLightbox(block.url)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setLightbox(block.url) }}
                  aria-label="Click to enlarge"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={block.url}
                    alt={caption || ''}
                    className="w-full object-cover"
                    style={{ maxHeight: 320, display: 'block' }}
                  />
                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-hidden
                  >
                    <span
                      className="text-xs font-semibold px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
                    >
                      Click to enlarge
                    </span>
                  </div>
                </div>
                {caption && (
                  <figcaption
                    className="text-xs text-center mt-2 font-body"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {caption}
                  </figcaption>
                )}
              </figure>
            )
          }

          const content = getContent(block, lang)
          if (!content) return null

          if (block.type === 'heading') {
            return (
              <h2
                key={i}
                className="font-display text-xl font-semibold pt-4"
                style={{ color: 'var(--text-primary)' }}
              >
                {content}
              </h2>
            )
          }

          if (block.type === 'callout') {
            return (
              <BentoCard key={i} variant="edge-info" colSpan={12}>
                <div className="flex items-start gap-3">
                  {block.emoji && (
                    <span className="text-xl flex-shrink-0 mt-0.5">{block.emoji}</span>
                  )}
                  <div
                    className="text-sm leading-relaxed font-body prose-sm"
                    style={{ color: 'var(--text-primary)' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                </div>
              </BentoCard>
            )
          }

          // paragraph
          return (
            <div
              key={i}
              className="text-base leading-relaxed font-body prose-sm"
              style={{ color: 'var(--text-secondary)' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )
        })}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={open => { if (!open) setLightbox(null) }}>
        <DialogOverlay
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        />
        <DialogContent
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ maxWidth: '100vw', backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}
          aria-label="Image lightbox"
        >
          {lightbox && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox}
              alt=""
              className="max-w-full rounded-xl"
              style={{ maxHeight: '85vh', objectFit: 'contain', width: 'auto' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
