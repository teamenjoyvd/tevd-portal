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
function excerptFromBody(body: Block[] | null, maxChars = 140): string {
  if (!body || body.length === 0) return ''
  const chunks: string[] = []
  let total = 0
  for (const block of body) {
    if (total >= maxChars) break
    const raw = JSON.stringify(block.content ?? '')
    const text = raw.replace(/["{}[\]]/g, ' ').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) { chunks.push(text); total += text.length }
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

  // ── Skeletons ────────────────────────────────────────────────────────────

  const skeletons = (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="rounded-2xl" style={{ height: 76 }} />
        ))}
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:flex gap-0" style={{ alignItems: 'flex-start' }}>
        <div className="flex flex-col gap-3" style={{ width: '38%' }}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="rounded-2xl" style={{ height: 76 }} />)}
        </div>
        <div className="shrink-0" style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border-default)', margin: '0 28px' }} />
        <div className="flex flex-col gap-3" style={{ flex: 1 }}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="rounded-2xl" style={{ height: 96 }} />)}
        </div>
      </div>
    </>
  )

  // ── Link card ────────────────────────────────────────────────────────────

  function LinkCard({ l }: { l: SiteLink }) {
    return (
      <a
        href={l.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors hover:border-[var(--border-hover)]"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          minHeight: 68,
        }}
      >
        <span
          className="shrink-0 flex items-center justify-center rounded-lg text-sm font-bold"
          style={{
            width: 32,
            height: 32,
            backgroundColor: 'color-mix(in srgb, var(--brand-crimson) 12%, transparent)',
            color: 'var(--brand-crimson)',
          }}
        >
          ↗
        </span>
        <div className="flex flex-col min-w-0">
          <p className="font-body text-sm font-semibold leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
            {linkLabel(l)}
          </p>
          <p className="font-body text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
            {l.url}
          </p>
        </div>
      </a>
    )
  }

  // ── Guide card ───────────────────────────────────────────────────────────

  function GuideCard({ g }: { g: Guide }) {
    const excerpt = excerptFromBody(g.body)
    return (
      <Link href={`/guides/${g.slug}`} className="group block">
        <div
          className="flex items-start gap-4 px-5 py-4 rounded-2xl transition-colors group-hover:border-[var(--border-hover)]"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            minHeight: 88,
          }}
        >
          <span className="shrink-0 text-3xl leading-none mt-0.5">{g.emoji ?? '📄'}</span>
          <div className="flex flex-col min-w-0">
            <p className="font-display text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {guideTitle(g)}
            </p>
            {excerpt && (
              <p className="font-body text-xs leading-relaxed mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {excerpt}
              </p>
            )}
          </div>
        </div>
      </Link>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="py-8 pb-24">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 xl:px-8">

        {isLoading ? skeletons : (
          <>
            {/* ── MOBILE: links then guides, single column ── */}
            <div className="md:hidden flex flex-col gap-3">
              {links.map(l => <LinkCard key={l.id} l={l} />)}
              {guides.map(g => <GuideCard key={g.id} g={g} />)}
              {links.length === 0 && guides.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nothing here yet.</p>
              )}
            </div>

            {/* ── DESKTOP: links left | divider | guides right ── */}
            <div className="hidden md:flex gap-0" style={{ alignItems: 'flex-start' }}>

              {/* Links column — narrower */}
              <div className="flex flex-col gap-3" style={{ width: '38%' }}>
                {links.map(l => <LinkCard key={l.id} l={l} />)}
                {links.length === 0 && (
                  <p className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>No links yet.</p>
                )}
              </div>

              {/* Vertical divider */}
              <div
                className="shrink-0"
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  minHeight: 200,
                  backgroundColor: 'var(--border-default)',
                  margin: '0 28px',
                }}
              />

              {/* Guides column — wider */}
              <div className="flex flex-col gap-3" style={{ flex: 1 }}>
                {guides.map(g => <GuideCard key={g.id} g={g} />)}
                {guides.length === 0 && (
                  <p className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>No guides yet.</p>
                )}
              </div>

            </div>
          </>
        )}

      </div>
    </div>
  )
}
