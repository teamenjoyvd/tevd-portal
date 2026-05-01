'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'

type Props = {
  titles: Record<string, string>
  contents: Record<string, string> | null
  slug?: string | null
}

export default function AnnouncementTile({ titles, contents, slug }: Props) {
  const { lang, t } = useLanguage()

  const title   = titles[lang] ?? titles['en'] ?? Object.values(titles)[0] ?? ''
  const content = contents ? (contents[lang] ?? contents['en'] ?? Object.values(contents)[0] ?? null) : null

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        {slug && (
          <Link href={`/news/${slug}`} className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
            {t('home.ann.moreLink')}
          </Link>
        )}
      </div>
      <div className="flex-1">
        {slug ? (
          <Link href={`/news/${slug}`}>
            <h2
              className="font-display text-xl font-semibold leading-snug mb-2 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
          </Link>
        ) : (
          <h2
            className="font-display text-xl font-semibold leading-snug mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
        )}
        {content && (
          <p
            className="font-body text-sm leading-relaxed"
            style={{
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {content}
          </p>
        )}
      </div>
    </>
  )
}
