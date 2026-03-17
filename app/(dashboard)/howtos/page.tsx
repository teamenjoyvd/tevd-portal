'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import PageHeading from '@/components/layout/PageHeading'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'

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
    <>
      <PageHeading title="How-tos" subtitle="Guides and resources" />
      <div className="py-8 pb-16">
        <BentoGrid>
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <BentoCard key={i} variant="default" colSpan={6}>
                  <div className="h-16 rounded-xl animate-pulse"
                    style={{ backgroundColor: 'var(--border-default)' }} />
                </BentoCard>
              ))}
            </>
          ) : howtos.length === 0 ? (
            <BentoCard variant="default" colSpan={12}>
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No guides available yet.
                </p>
              </div>
            </BentoCard>
          ) : (
            <>
              {howtos.map(h => {
                const title = (h.title as Record<string, string>)[lang]
                  ?? (h.title as Record<string, string>).en ?? ''
                return (
                  <Link key={h.id} href={`/howtos/${h.slug}`}
                    style={{ gridColumn: 'span 6', display: 'block' }}
                    className="group">
                    <BentoCard variant="default" className="h-full flex items-center gap-4 transition-colors group-hover:border-[var(--border-hover)]">
                      <span className="text-3xl flex-shrink-0">{h.emoji ?? '📄'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-semibold truncate"
                          style={{ color: 'var(--text-primary)' }}>
                          {title}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-secondary)" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </BentoCard>
                  </Link>
                )
              })}
            </>
          )}
        </BentoGrid>
      </div>
    </>
  )
}
