'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTileMaxItems } from '@/lib/hooks/useBentoConfig'
import BentoCard from '@/components/bento/BentoCard'
import { Eyebrow } from '@/components/bento/BentoCard'
import { apiClient } from '@/lib/apiClient'

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
}

export default function GuidesTile({ colSpan = 6, rowSpan, mobileColSpan }: { colSpan?: number; rowSpan?: number; mobileColSpan?: number }) {
  const { isLoaded } = useUser()
  const { lang, t } = useLanguage()
  const maxItems = useTileMaxItems('guides', 4)

  const { data: guides = [], isLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'tile', maxItems],
    queryFn: () => apiClient(`/api/guides?limit=${maxItems}`),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  })

  if (guides.length === 0) return null

  return (
    <BentoCard variant="default" colSpan={colSpan} rowSpan={rowSpan} mobileColSpan={mobileColSpan} className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>{t('home.guides.title')}</Eyebrow>
        <Link
          href="/guides"
          className="text-xs font-semibold tracking-widest uppercase transition-colors hover:opacity-70"
          style={{ color: 'var(--brand-crimson)' }}
        >
          {t('home.guides.viewAll')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3 flex-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-1 flex-1">
          {guides.map(g => {
            const title = (g.title as Record<string, string>)[lang]
              ?? (g.title as Record<string, string>).en
              ?? ''
            return (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-black/[0.04] group"
              >
                <span className="text-base flex-shrink-0 w-6 text-center">
                  {g.emoji ?? '\ud83d\udcc4'}
                </span>
                <span className="flex-1 text-sm font-medium truncate font-body"
                  style={{ color: 'var(--text-primary)' }}>
                  {title}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </Link>
            )
          })}
        </div>
      )}
    </BentoCard>
  )
}
