'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
}

export default function GuidesPage() {
  const { lang } = useLanguage()

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'list'],
    queryFn: () => fetch('/api/guides').then(r => r.json()),
  })

  const skeletonCard = (i: number) => (
    <div
      key={i}
      className="rounded-2xl animate-pulse"
      style={{ height: 240, backgroundColor: 'var(--border-default)' }}
    />
  )

  const emptyState = (
    <div
      className="rounded-2xl flex items-center justify-center py-16"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        No guides available yet.
      </p>
    </div>
  )

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[960px] mx-auto px-4">
        {/* Mobile: single-column stack */}
        <div className="md:hidden flex flex-col gap-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => skeletonCard(i))
          ) : guides.length === 0 ? emptyState : (
            guides.map(g => {
              const title = (g.title as Record<string, string>)[lang]
                ?? (g.title as Record<string, string>).en ?? ''
              return (
                <Link key={g.id} href={`/guides/${g.slug}`} className="group block">
                  <div
                    className="rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-150 hover:shadow-sm group-hover:border-[var(--border-hover)]"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', minHeight: 160 }}
                  >
                    <span className="text-4xl">{g.emoji ?? '📄'}</span>
                    <div className="flex items-end justify-between gap-3 mt-4">
                      <p className="font-display text-xl font-semibold leading-snug"
                        style={{ color: 'var(--text-primary)' }}>
                        {title}
                      </p>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-secondary)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Desktop: 2-up 8-col grid */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'minmax(120px, auto)',
          }}
        >
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{
                  gridColumn: 'span 4',
                  gridRow: 'span 2',
                  backgroundColor: 'var(--border-default)',
                  minHeight: 240,
                }}
              />
            ))
          ) : guides.length === 0 ? (
            <div
              style={{
                gridColumn: 'span 8',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
              }}
              className="rounded-2xl flex items-center justify-center py-16"
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No guides available yet.
              </p>
            </div>
          ) : (
            guides.map(g => {
              const title = (g.title as Record<string, string>)[lang]
                ?? (g.title as Record<string, string>).en ?? ''
              return (
                <Link
                  key={g.id}
                  href={`/guides/${g.slug}`}
                  style={{ gridColumn: 'span 4', gridRow: 'span 2', display: 'block', minHeight: 240 }}
                  className="group"
                >
                  <div
                    className="h-full rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-150 hover:shadow-sm group-hover:border-[var(--border-hover)]"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                  >
                    <span className="text-4xl">{g.emoji ?? '📄'}</span>
                    <div className="flex items-end justify-between gap-3">
                      <p className="font-display text-xl font-semibold leading-snug"
                        style={{ color: 'var(--text-primary)' }}>
                        {title}
                      </p>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-secondary)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
