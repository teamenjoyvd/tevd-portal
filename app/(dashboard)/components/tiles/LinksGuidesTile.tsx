'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'
import BentoCard from '@/components/bento/BentoCard'

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
}

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
}

const MAX_LINKS  = 2
const MAX_GUIDES = 2

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function LinksGuidesTile({
  links: linksProp = [],
  guides: guidesProp = [],
  colSpan = 3,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  links?: SiteLink[]
  guides?: Guide[]
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { lang, t } = useLanguage()

  const visibleLinks  = linksProp.slice(0, MAX_LINKS)
  const guideSlotsAvailable = MAX_GUIDES + (MAX_LINKS - visibleLinks.length)
  const visibleGuides = guidesProp.slice(0, guideSlotsAvailable)

  const hasLinks  = visibleLinks.length > 0
  const hasGuides = visibleGuides.length > 0

  if (!hasLinks && !hasGuides) return null

  function resolveLabel(l: SiteLink) {
    return (l.label as Record<string, string>)[lang] ?? l.label.en ?? ''
  }

  function resolveTitle(g: Guide) {
    return (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''
  }

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className="flex flex-col gap-0.5"
      style={style}
    >
      <div className="flex items-center justify-end mb-4">
        <Link href="/library" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          {t('home.guides.libraryLink')}
        </Link>
      </div>

      {visibleLinks.map(link => (
        <a
          key={link.id}
          href={normaliseUrl(link.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-2 py-[7px] rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          <span
            className="flex-shrink-0 flex items-center justify-center rounded-[6px]"
            style={{ width: 22, height: 22, background: '#bc474914' }}
          >
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </span>
          <span
            className="flex-1 text-[13px] font-medium truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {resolveLabel(link)}
          </span>
        </a>
      ))}

      {visibleGuides.map(g => (
        <Link
          key={g.id}
          href={`/library/${g.slug}`}
          className="flex items-center gap-2.5 px-2 py-[7px] rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          <span
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 22, height: 22, fontSize: 14 }}
          >
            {g.emoji ?? '📄'}
          </span>
          <span
            className="flex-1 text-[13px] font-medium truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {resolveTitle(g)}
          </span>
        </Link>
      ))}
    </BentoCard>
  )
}
