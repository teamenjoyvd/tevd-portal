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

function getCaption(block: ImageBlock, lang: string): string {
  if (!block.caption) return ''
  return (block.caption as Record<string, string>)[lang] ?? block.caption.en ?? ''
}

export default function GuideBody({
  blocks,
  lang,
}: {
  blocks: unknown[] | null
  lang: string
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxCaption, setLightboxCaption] = useState<string>('')

  function openLightbox(url: string, caption: string) {
    setLightboxUrl(url)
    setLightboxCaption(caption)
  }

  function closeLightbox() {
    setLightboxUrl(null)
    setLightboxCaption('')
  }

  if (!blocks || blocks.length === 0) return null

  const typedBlocks = blocks as Block[]

  // Collect runs of consecutive image blocks to render as thumbnail strips
  const rendered: React.ReactNode[] = []
  let i = 0

  while (i < typedBlocks.length) {
    const block = typedBlocks[i]

    if (block.type === 'image') {
      // Collect the full run of consecutive image blocks
      const run: ImageBlock[] = []
      while (i < typedBlocks.length && typedBlocks[i].type === 'image') {
        run.push(typedBlocks[i] as ImageBlock)
        i++
      }

      rendered.push(
        <div key={`img-run-${i}`} className="flex flex-row flex-wrap gap-2">
          {run.map((imgBlock, j) => {
            if (!imgBlock.url) return null
            const caption = getCaption(imgBlock, lang)
            return (
              <div key={j} className="flex flex-col items-center" style={{ width: 88 }}>
                <button
                  type="button"
                  className="cursor-zoom-in rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2"
                  style={{ width: 88, height: 88, flexShrink: 0 }}
                  onClick={() => openLightbox(imgBlock.url, caption)}
                  aria-label={caption || 'View image'}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgBlock.url}
                    alt={caption || ''}
                    style={{ width: 88, height: 88, objectFit: 'cover', display: 'block' }}
                  />
                </button>
                {caption && (
                  <span
                    className="mt-1 text-center leading-tight"
                    style={{
                      fontSize: 10,
                      width: 88,
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    title={caption}
                  >
                    {caption}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )
      continue
    }

    const content = getContent(block as TextBlock, lang)
    if (!content) { i++; continue }

    if (block.type === 'heading') {
      rendered.push(
        <h2
          key={i}
          className="font-display text-xl font-semibold pt-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {content}
        </h2>
      )
    } else if (block.type === 'callout') {
      rendered.push(
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
    } else {
      // paragraph
      rendered.push(
        <div
          key={i}
          className="text-base leading-relaxed font-body prose-sm"
          style={{ color: 'var(--text-secondary)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )
    }

    i++
  }

  return (
    <>
      <div className="guide-body max-w-2xl space-y-6">
        {rendered}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => { if (!open) closeLightbox() }}>
        <DialogOverlay style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} />
        <DialogContent
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent border-none shadow-none p-0 max-w-[90vw] flex flex-col items-center gap-3 [&>button]:text-white [&>button]:opacity-100 [&>button]:bg-black/40 [&>button]:rounded-full [&>button]:p-1"
          aria-label="Image lightbox"
        >
          {lightboxUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxUrl}
                alt={lightboxCaption || ''}
                className="rounded-xl max-w-full"
                style={{ maxHeight: '80vh', objectFit: 'contain', width: 'auto' }}
              />
              {lightboxCaption && (
                <p
                  className="text-sm text-center font-body"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                >
                  {lightboxCaption}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
