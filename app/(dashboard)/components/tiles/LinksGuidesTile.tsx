'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import BentoCard from '@/components/bento/BentoCard'

type QuickLink = { id: string; label: string; url: string; icon_name: string }
type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
}

const MAX_ITEMS = 4

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '#'
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export default function LinksGuidesTile({
  quickLinks,
  colSpan = 3,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  quickLinks: QuickLink[]
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { isLoaded } = useUser()
  const { lang } = useLanguage()

  const visibleLinks = quickLinks.slice(0, MAX_ITEMS)
  const guideSlotsAvailable = MAX_ITEMS - visibleLinks.length

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'tile', guideSlotsAvailable],
    queryFn: () =>
      fetch(`/api/guides?limit=${guideSlotsAvailable}`).then(r => r.json()),
    enabled: isLoaded && guideSlotsAvailable > 0,
    staleTime: 5 * 60 * 1000,
  })

  const hasLinks = visibleLinks.length > 0
  const hasGuides = guides.length > 0 || isLoading

  if (!hasLinks && !hasGuides) return null

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
            className="flex-shrink-0 w-[22px] text-center text-[10px]"
            style={{ color: 'var(--text-secondary)', opacity: 0.45 }}
          >
            •
          </span>
          <span
            className="flex-1 text-[13px] font-medium truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {link.label}
          </span>
        </a>
      ))}

      {guideSlotsAvailable > 0 && isLoading &&
        [...Array(Math.min(2, guideSlotsAvailable))].map((_, i) => (
          <div
            key={i}
            className="h-8 mx-2 rounded-lg animate-pulse"
            style={{ backgroundColor: 'var(--border-default)' }}
          />
        ))
      }

      {guideSlotsAvailable > 0 && !isLoading &&
        guides.map(g => {
          const title =
            (g.title as Record<string, string>)[lang] ??
            (g.title as Record<string, string>).en ??
            ''
          return (
            <Link
              key={g.id}
              href={`/guides/${g.slug}`}
              className="flex items-center gap-2.5 px-2 py-[7px] rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <span
                className="flex-shrink-0 w-[22px] text-center text-[10px]"
                style={{ color: 'var(--text-secondary)', opacity: 0.45 }}
              >
                •
              </span>
              <span
                className="flex-1 text-[13px] font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {title}
              </span>
            </Link>
          )
        })
      }

      {hasGuides && !isLoading && (
        <Link
          href="/guides"
          className="flex items-center justify-center mt-1.5 px-2 py-[5px] rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          <span
            className="text-[11px] font-semibold tracking-[0.06em] uppercase"
            style={{ color: 'var(--text-secondary)' }}
          >
            All guides
          </span>
        </Link>
      )}
    </BentoCard>
  )
}
