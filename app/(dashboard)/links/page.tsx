'use client'

import { useQuery } from '@tanstack/react-query'
import PageHeading from '@/components/layout/PageHeading'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'

type QuickLink = {
  id: string
  label: string
  url: string
  icon_name: string
  sort_order: number
}

export default function LinksPage() {
  const { data: links = [], isLoading } = useQuery<QuickLink[]>({
    queryKey: ['quick-links', 'public'],
    queryFn: () => fetch('/api/admin/quick-links').then(r => r.json()),
  })

  return (
    <>
      <PageHeading title="Quick Links" subtitle="Useful resources and tools" />
      <div className="py-8 pb-16">
        <BentoGrid>
          {isLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <BentoCard key={i} variant="default" colSpan={6}>
                  <div className="h-20 rounded-xl animate-pulse"
                    style={{ backgroundColor: 'var(--border-default)' }} />
                </BentoCard>
              ))}
            </>
          ) : links.length === 0 ? (
            <BentoCard variant="default" colSpan={12}>
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No links configured yet.
                </p>
              </div>
            </BentoCard>
          ) : (
            <>
              {links.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ gridColumn: 'span 6', display: 'block' }}
                  className="group"
                >
                  <BentoCard variant="default" className="h-full transition-colors group-hover:border-[var(--border-hover)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'var(--border-default)' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate font-body"
                            style={{ color: 'var(--text-primary)' }}>
                            {link.label}
                          </p>
                          <p className="text-xs truncate mt-0.5"
                            style={{ color: 'var(--text-secondary)' }}>
                            {link.url}
                          </p>
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
                      </svg>
                    </div>
                  </BentoCard>
                </a>
              ))}
            </>
          )}
        </BentoGrid>
      </div>
    </>
  )
}
