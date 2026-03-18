'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Howto = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  created_at: string
}

export default function HowtosPage() {
  const { lang } = useLanguage()

  const { data: howtos = [], isLoading } = useQuery<Howto[]>({
    queryKey: ['howtos', 'list'],
    queryFn: () => fetch('/api/howtos').then(r => r.json()),
  })

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[960px] mx-auto px-4">
        <div
          style={{
            display: 'grid',
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
          ) : howtos.length === 0 ? (
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
            howtos.map(h => {
              const title = (h.title as Record<string, string>)[lang]
                ?? (h.title as Record<string, string>).en ?? ''
              return (
                <Link
                  key={h.id}
                  href={`/howtos/${h.slug}`}
                  style={{ gridColumn: 'span 4', gridRow: 'span 2', display: 'block', minHeight: 240 }}
                  className="group"
                >
                  <div
                    className="h-full rounded-2xl p-6 flex flex-col justify-between transition-colors group-hover:border-[var(--border-hover)]"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                  >
                    <span className="text-4xl">{h.emoji ?? '📄'}</span>
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
