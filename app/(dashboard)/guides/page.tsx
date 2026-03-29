'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Skeleton } from '@/components/ui/Skeleton'

type Block = { type: string; content?: unknown }

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  body: Block[] | null
}

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
}

/** Extract up to `maxChars` of plain text from a block-editor body array. */
function excerptFromBody(body: Block[] | null, maxChars = 160): string {
  if (!body || body.length === 0) return ''
  const chunks: string[] = []
  let total = 0
  for (const block of body) {
    if (total >= maxChars) break
    const raw = JSON.stringify(block.content ?? '')
    // strip JSON punctuation and quotes to get readable words
    const text = raw.replace(/["{}\[\]]/g, ' ').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) {
      chunks.push(text)
      total += text.length
    }
  }
  const joined = chunks.join(' ').slice(0, maxChars)
  return joined.length < chunks.join(' ').length ? joined + '…' : joined
}

export default function GuidesPage() {
  const { lang } = useLanguage()

  const { data: guides = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'list'],
    queryFn: () => fetch('/api/guides').then(r => r.json()),
  })

  const { data: links = [], isLoading: linksLoading } = useQuery<SiteLink[]>({
    queryKey: ['links', 'list'],
    queryFn: () => fetch('/api/links').then(r => r.json()),
  })

  const isLoading = guidesLoading || linksLoading

  function guideTitle(g: Guide) {
    return (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''
  }
  function linkLabel(l: SiteLink) {
    return (l.label as Record<string, string>)[lang] ?? l.label.en ?? ''
  }

  const skeletons = (
    <div className="flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="rounded-2xl" style={{ height: 80 }} />
      ))}
    </div>
  )

  const content = (
    <div className="flex flex-col gap-3">

      {/* ── Links ── */}
      {links.map(l => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 px-6 rounded-2xl transition-colors hover:border-[var(--border-hover)]"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            minHeight: 72,
          }}
        >
          <span
            className="shrink-0 flex items-center justify-center rounded-xl text-base font-bold"
            style={{
              width: 36,
              height: 36,
              backgroundColor: 'rgba(var(--brand-crimson-rgb, 188,71,73), 0.12)',
              color: 'var(--brand-crimson)',
            }}
          >
            ↗
          </span>
          <div className="flex flex-col min-w-0">
            <p
              className="font-body text-sm font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {linkLabel(l)}
            </p>
            <p
              className="font-body text-xs mt-0.5 truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {l.url}
            </p>
          </div>
        </a>
      ))}

      {/* ── Guides ── */}
      {guides.map(g => {
        const excerpt = excerptFromBody(g.body)
        return (
          <Link key={g.id} href={`/guides/${g.slug}`} className="group block">
            <div
              className="flex items-start gap-4 px-6 py-5 rounded-2xl transition-colors group-hover:border-[var(--border-hover)]"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                minHeight: 88,
              }}
            >
              <span className="shrink-0 text-3xl leading-none mt-0.5">
                {g.emoji ?? '📄'}
              </span>
              <div className="flex flex-col min-w-0">
                <p
                  className="font-display text-base font-semibold leading-snug"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {guideTitle(g)}
                </p>
                {excerpt && (
                  <p
                    className="font-body text-xs leading-relaxed mt-1 line-clamp-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {excerpt}
                  </p>
                )}
              </div>
            </div>
          </Link>
        )
      })}

      {links.length === 0 && guides.length === 0 && (
        <p className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>Nothing here yet.</p>
      )}

    </div>
  )

  return (
    <div className="py-8 pb-24">
      <div className="max-w-[640px] mx-auto px-4 sm:px-6">
        {isLoading ? skeletons : content}
      </div>
    </div>
  )
}
