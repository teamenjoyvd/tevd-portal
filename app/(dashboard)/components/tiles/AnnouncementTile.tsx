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

  const resolve = (obj: Record<string, string> | null) =>
    obj ? (obj[lang] ?? obj['en'] ?? Object.values(obj)[0] ?? null) : null
  const title   = resolve(titles) ?? ''
  const content = resolve(contents)

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
              className="font-display text-xl font-semibold leading-snug mb-2 md:line-clamp-2 md:min-h-[2.75em] hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
          </Link>
        ) : (
          <h2
            className="font-display text-xl font-semibold leading-snug mb-2 md:line-clamp-2 md:min-h-[2.75em]"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
        )}
        {content && (
          <p
            className="font-body text-sm leading-relaxed line-clamp-4 md:line-clamp-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            {content}
          </p>
        )}
      </div>
    </>
  )
}
