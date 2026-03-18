'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { useTileMaxItems } from '@/lib/hooks/useBentoConfig'
import BentoCard from '@/components/bento/BentoCard'
import { Eyebrow } from '@/components/bento/BentoCard'

type Howto = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
}

export default function HowtosTile({ colSpan = 6, rowSpan, halfWidthMobile }: { colSpan?: number; rowSpan?: number; halfWidthMobile?: boolean }) {
  const { isLoaded } = useUser()
  const { lang } = useLanguage()
  const maxItems = useTileMaxItems('howtos', 4)

  const { data: howtos = [], isLoading } = useQuery<Howto[]>({
    queryKey: ['howtos', 'tile', maxItems],
    queryFn: () => fetch(`/api/howtos?limit=${maxItems}`).then(r => r.json()),
    enabled: isLoaded,
    staleTime: 5 * 60 * 1000,
  })

  // Hide tile entirely if no howtos visible for this user
  if (!isLoading && howtos.length === 0) return null

  return (
    <BentoCard variant="default" colSpan={colSpan} rowSpan={rowSpan} halfWidthMobile={halfWidthMobile} className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>How-tos</Eyebrow>
        <Link
          href="/howtos"
          className="text-xs font-semibold tracking-widest uppercase transition-colors hover:opacity-70"
          style={{ color: 'var(--brand-crimson)' }}
        >
          View all →
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
          {howtos.map(h => {
            const title = (h.title as Record<string, string>)[lang]
              ?? (h.title as Record<string, string>).en
              ?? ''
            return (
              <Link
                key={h.id}
                href={`/howtos/${h.slug}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-black/[0.04] group"
              >
                <span className="text-base flex-shrink-0 w-6 text-center">
                  {h.emoji ?? '📄'}
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
