'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'

type QuickLink = { id: string; label: string; url: string; icon_name: string }
type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
}

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

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'tile', 3],
    queryFn: () => fetch('/api/guides?limit=3').then(r => r.json()),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  })

  const hasLinks = quickLinks.length > 0
  const hasGuides = guides.length > 0 || isLoading

  if (!hasLinks && !hasGuides) return null

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className="flex flex-col gap-4"
      style={style}
    >
      {hasLinks && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Eyebrow>Quick Access</Eyebrow>
          </div>
          <div className="flex flex-col gap-1">
            {quickLinks.map(link => (
              <a
                key={link.id}
                href={normaliseUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium truncate hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ flexShrink: 0, opacity: 0.5 }}>→</span>
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {hasLinks && hasGuides && (
        <div className="h-px w-full" style={{ backgroundColor: 'var(--border-default)' }} />
      )}

      {hasGuides && (
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-2">
            <Eyebrow>Guides</Eyebrow>
            <Link
              href="/guides"
              className="text-xs font-semibold tracking-widest uppercase hover:opacity-70 transition-opacity"
              style={{ color: 'var(--brand-crimson)' }}
            >
              All →
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded-lg animate-pulse"
                  style={{ backgroundColor: 'var(--border-default)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {guides.map(g => {
                const title =
                  (g.title as Record<string, string>)[lang] ??
                  (g.title as Record<string, string>).en ??
                  ''
                return (
                  <Link
                    key={g.id}
                    href={`/guides/${g.slug}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-black/[0.04] transition-colors group"
                  >
                    <span className="text-sm flex-shrink-0 w-5 text-center">
                      {g.emoji ?? '📄'}
                    </span>
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {title}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-secondary)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </BentoCard>
  )
}
