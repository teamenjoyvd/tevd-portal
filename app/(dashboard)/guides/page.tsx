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

// ── SVG icons — all render in currentColor, caller sets color via style ──

function IconLink({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 10L10 6M10 6H7M10 6V9" />
      <path d="M3 13L2 14M13 3L14 2M8.5 2.5L10 1H15v5l-1.5 1.5" opacity="0.4" />
      <rect x="1" y="5" width="9" height="9" rx="1.5" />
    </svg>
  )
}

function IconBook({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 13.5C8 13.5 3 11 3 5V2.5L8 1l5 1.5V5c0 6-5 8.5-5 8.5Z" />
      <path d="M8 4v5M6 6l2-2 2 2" opacity="0.5" />
    </svg>
  )
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

  // ── Skeletons ─────────────────────────────────────────────────────────────

  const skeletons = (
    <>
      <div className="md:hidden flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="rounded-2xl" style={{ height: 76 }} />
        ))}
      </div>
      <div className="hidden md:flex gap-0" style={{ alignItems: 'flex-start' }}>
        <div className="flex flex-col gap-3" style={{ width: '38%' }}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="rounded-2xl" style={{ height: 68 }} />)}
        </div>
        <div className="shrink-0" style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border-default)', margin: '0 28px' }} />
        <div className="flex flex-col gap-3" style={{ flex: 1 }}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="rounded-2xl" style={{ height: 88 }} />)}
        </div>
      </div>
    </>
  )

  // ── Link card ─────────────────────────────────────────────────────────────

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
          className="shrink-0"
          style={{ color: 'var(--brand-crimson)', opacity: 0.7 }}
        >
          <IconLink size={16} />
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

  // ── Guide card ────────────────────────────────────────────────────────────

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
          <span
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--brand-crimson)', opacity: 0.75 }}
          >
            <IconBook size={18} />
          </span>
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

  // ── Layout ────────────────────────────────────────────────────────────────

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

              <div className="flex flex-col gap-3" style={{ width: '38%' }}>
                {links.map(l => <LinkCard key={l.id} l={l} />)}
                {links.length === 0 && (
                  <p className="text-sm px-1" style={{ color: 'var(--text-secondary)' }}>No links yet.</p>
                )}
              </div>

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
