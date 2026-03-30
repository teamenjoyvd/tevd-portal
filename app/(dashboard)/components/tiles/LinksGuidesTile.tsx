'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
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
  colSpan = 3,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  links?: SiteLink[]
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { isLoaded } = useUser()
  const { lang } = useLanguage()

  // Take up to MAX_LINKS from the prop; fill remaining slots with guides
  const visibleLinks  = linksProp.slice(0, MAX_LINKS)
  const guideSlotsAvailable = MAX_GUIDES + (MAX_LINKS - visibleLinks.length)

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'tile', guideSlotsAvailable],
    queryFn: () =>
      fetch(`/api/guides?limit=${guideSlotsAvailable}`).then(r => r.json()),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  })

  const hasLinks  = visibleLinks.length > 0
  const hasGuides = guides.length > 0 || isLoading

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

      {isLoading &&
        [...Array(Math.min(2, guideSlotsAvailable))].map((_, i) => (
          <div
            key={i}
            className="h-8 mx-2 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--border-default)' }}
          />
        ))
      }

      {!isLoading &&
        guides.map(g => (
          <Link
            key={g.id}
            href={`/guides/${g.slug}`}
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
        ))
      }

      {hasGuides && !isLoading && (
        <Link
          href="/guides"
          className="flex items-center justify-center mt-1.5 px-2.5 py-1 rounded-full transition-all hover:bg-[rgba(188,71,73,0.12)] hover:text-[var(--brand-crimson)]"
        >
          <span
            className="text-[11px] font-semibold tracking-[0.06em] uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            All guides &amp; links
          </span>
        </Link>
      )}
    </BentoCard>
  )
}
