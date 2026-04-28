'use client'

import Link from 'next/link'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/format'
import type { Guide, SiteLink, NewsItem } from '@/lib/server/guides'

export type Props = {
  initialGuides: Guide[]
  initialLinks: SiteLink[]
  initialNews: NewsItem[]
  guideHrefPrefix: string
}

/** Ensure URL has a protocol prefix so browsers don't treat it as a relative path. */
function normaliseUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

/** Extract up to `maxChars` of plain text from a block-editor body array. */
type Block = { type: string; content?: unknown }
function excerptFromBody(body: unknown[] | null, maxChars = 140): string {
  if (!body || body.length === 0) return ''
  const chunks: string[] = []
  let total = 0
  for (const block of body as Block[]) {
    if (total >= maxChars) break
    const raw = JSON.stringify(block.content ?? '')
    const text = raw.replace(/["{}[\]]/g, ' ').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (text) { chunks.push(text); total += text.length }
  }
  const joined = chunks.join(' ').slice(0, maxChars)
  return joined.length < chunks.join(' ').length ? joined + '\u2026' : joined
}

// ── SVG icons ──────────────────────────────────────────────────────────────────────────────────

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

function IconNews({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="2" width="14" height="12" rx="1.5" />
      <path d="M4 6h8M4 9h6M4 12h4" />
    </svg>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-default)',
}

const TAB_VALUES = ['all', 'news', 'guides', 'links'] as const
type TabValue = typeof TAB_VALUES[number]

// ── Inner client — reads searchParams ─────────────────────────────────────────────────

function GuidesInner({ initialGuides: guides, initialLinks: links, initialNews: news, guideHrefPrefix }: Props) {
  const { lang, t } = useLanguage()
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawTab = searchParams.get('type') ?? 'all'
  const tab: TabValue = (TAB_VALUES as readonly string[]).includes(rawTab) ? rawTab as TabValue : 'all'

  // Data is always present from SSR — no client fetching, no loading state.
  // To pick up content changes, the RSC page re-runs on router.refresh().

  function guideTitle(g: Guide) {
    return (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''
  }
  function linkLabel(l: SiteLink) {
    return (l.label as Record<string, string>)[lang] ?? l.label.en ?? ''
  }
  function newsTitle(n: NewsItem) {
    return n.titles[lang as 'en' | 'bg'] ?? n.titles.en ?? ''
  }
  function newsExcerpt(n: NewsItem) {
    return n.contents[lang as 'en' | 'bg'] ?? n.contents.en ?? ''
  }

  // ── Cards ──────────────────────────────────────────────────────────────────────────
  function LinkCard({ l }: { l: SiteLink }) {
    return (
      <a
        href={normaliseUrl(l.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:brightness-95 active:scale-[0.98] transition-all"
        style={{ ...cardStyle, minHeight: 68 }}
      >
        <span className="shrink-0" style={{ color: 'var(--brand-crimson)', opacity: 0.7 }}>
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

  function GuideCard({ g }: { g: Guide }) {
    const excerpt = excerptFromBody(g.body)
    return (
      <Link
        href={`${guideHrefPrefix}/${g.slug}`}
        className="flex items-start gap-4 px-5 py-4 rounded-2xl hover:brightness-95 active:scale-[0.98] transition-all"
        style={{ ...cardStyle, minHeight: 88 }}
      >
        <span className="shrink-0 mt-0.5" style={{ color: 'var(--brand-crimson)', opacity: 0.75 }}>
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
      </Link>
    )
  }

  function NewsCard({ n }: { n: NewsItem }) {
    const title = newsTitle(n)
    const excerpt = newsExcerpt(n)
    const inner = (
      <div className="flex items-start gap-4 px-5 py-4 rounded-2xl hover:brightness-95 active:scale-[0.98] transition-all" style={{ ...cardStyle, minHeight: 80 }}>
        <span className="shrink-0 mt-0.5" style={{ color: 'var(--brand-crimson)', opacity: 0.75 }}>
          <IconNews size={18} />
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <p className="font-display text-base font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {title}
          </p>
          {excerpt && (
            <p className="font-body text-xs leading-relaxed mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {excerpt}
            </p>
          )}
        </div>
        <span className="text-xs shrink-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(n.created_at)}
        </span>
      </div>
    )
    if (n.slug) {
      return <Link href={`/news/${n.slug}`}>{inner}</Link>
    }
    return inner
  }

  // ── Tab content helpers ─────────────────────────────────────────────────────────────────
  function AllTab() {
    const empty = news.length === 0 && guides.length === 0 && links.length === 0
    return (
      <div className="flex flex-col gap-3">
        {news.map(n => <NewsCard key={n.id} n={n} />)}
        {guides.map(g => <GuideCard key={g.id} g={g} />)}
        {links.map(l => <LinkCard key={l.id} l={l} />)}
        {empty && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('guides.emptyAll')}</p>}
      </div>
    )
  }

  function NewsTab() {
    return (
      <div className="flex flex-col gap-3">
        {news.map(n => <NewsCard key={n.id} n={n} />)}
        {news.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('guides.emptyNews')}</p>}
      </div>
    )
  }

  function GuidesTab() {
    return (
      <div className="flex flex-col gap-3">
        {guides.map(g => <GuideCard key={g.id} g={g} />)}
        {guides.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('guides.emptyGuides')}</p>}
      </div>
    )
  }

  function LinksTab() {
    return (
      <div className="flex flex-col gap-3">
        {links.map(l => <LinkCard key={l.id} l={l} />)}
        {links.length === 0 && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('guides.emptyLinks')}</p>}
      </div>
    )
  }

  // ── Layout ────────────────────────────────────────────────────────────────────────
  return (
    <div className="py-8 pb-24">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 xl:px-8">
        <Tabs
          value={tab}
          onValueChange={(val) => {
            const params = new URLSearchParams(searchParams.toString())
            params.set('type', val)
            router.replace(`?${params.toString()}`, { scroll: false })
          }}
        >
          <TabsList className="mb-6">
            <TabsTrigger value="all">{t('guides.filter.all')}</TabsTrigger>
            <TabsTrigger value="news">{t('guides.filter.news')}</TabsTrigger>
            <TabsTrigger value="guides">{t('guides.filter.guides')}</TabsTrigger>
            <TabsTrigger value="links">{t('guides.filter.links')}</TabsTrigger>
          </TabsList>
          <TabsContent value="all"><AllTab /></TabsContent>
          <TabsContent value="news"><NewsTab /></TabsContent>
          <TabsContent value="guides"><GuidesTab /></TabsContent>
          <TabsContent value="links"><LinksTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function GuidesClient(props: Props) {
  return (
    <Suspense>
      <GuidesInner {...props} />
    </Suspense>
  )
}
