'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { Skeleton } from '@/components/ui/Skeleton'

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
}

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
}

export default function GuidesPage() {
  const { lang } = useLanguage()

  const { data: guides = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['guides', 'list'],
    queryFn: () => fetch('/api/guides').then(r => r.json()),
  })

  const { data: links = [], isLoading: linksLoading } = useQuery<SiteLink[]>({
    queryKey: ['links', 'list'],
    queryFn: () => fetch('/api/links').then(r => r.json()),
  })

  const isLoading = guidesLoading || linksLoading

  function guideTitle(g: Guide) {
    return (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''
  }
  function linkLabel(l: SiteLink) {
    return (l.label as Record<string, string>)[lang] ?? l.label.en ?? ''
  }

  return (
    <div className="py-8 pb-16">
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 xl:px-8">

        {/* ── MOBILE: links then guides, single column ── */}
        <div className="md:hidden flex flex-col gap-3">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Skeleton key={i} className="rounded-2xl" style={{ height: 56 }} />
            ))
          ) : (
            <>
              {links.map(l => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-4 rounded-2xl transition-colors hover:border-[var(--border-hover)]"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {linkLabel(l)}
                  </p>
                </a>
              ))}
              {guides.map(g => (
                <Link key={g.id} href={`/guides/${g.slug}`} className="group block">
                  <div
                    className="rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-150 group-hover:border-[var(--border-hover)]"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', minHeight: 160 }}
                  >
                    <span className="text-4xl">{g.emoji ?? '📄'}</span>
                    <p className="font-display text-xl font-semibold leading-snug mt-4"
                      style={{ color: 'var(--text-primary)' }}>
                      {guideTitle(g)}
                    </p>
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* ── DESKTOP: 12-col grid, col-4 empty | col-2 links | col-4 guides | col-2 empty ── */}
        <div
          className="hidden md:grid"
          style={{
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <Skeleton
                  key={`ls-${i}`}
                  className="rounded-2xl"
                  style={{ gridColumn: '5 / span 2', height: 48 }}
                />
              ))}
              {[...Array(3)].map((_, i) => (
                <Skeleton
                  key={`gs-${i}`}
                  className="rounded-2xl"
                  style={{ gridColumn: '7 / span 4', minHeight: 240 }}
                />
              ))}
            </>
          ) : (
            <>
              {/* Links column: col 5–6 */}
              <div style={{ gridColumn: '5 / span 2', gridRow: '1' }} className="flex flex-col gap-2">
                {links.map(l => (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-3 rounded-2xl transition-colors hover:border-[var(--border-hover)]"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                  >
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {linkLabel(l)}
                    </p>
                  </a>
                ))}
                {links.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>No links yet.</p>
                )}
              </div>

              {/* Guides column: col 7–10, 2-up grid */}
              <div
                style={{
                  gridColumn: '7 / span 4',
                  gridRow: '1',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px',
                }}
              >
                {guides.map(g => (
                  <Link
                    key={g.id}
                    href={`/guides/${g.slug}`}
                    className="group block"
                  >
                    <div
                      className="h-full rounded-2xl p-6 flex flex-col justify-between transition-shadow duration-150 group-hover:border-[var(--border-hover)]"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', minHeight: 240 }}
                    >
                      <span className="text-4xl">{g.emoji ?? '📄'}</span>
                      <p className="font-display text-xl font-semibold leading-snug mt-4"
                        style={{ color: 'var(--text-primary)' }}>
                        {guideTitle(g)}
                      </p>
                    </div>
                  </Link>
                ))}
                {guides.length === 0 && (
                  <div
                    className="rounded-2xl flex items-center justify-center py-16"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
                  >
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No guides yet.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
