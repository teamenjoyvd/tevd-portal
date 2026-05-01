'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/hooks/useLanguage'

export default function AboutTile() {
  const { t } = useLanguage()

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Link href="/about" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          {t('home.about.aboutLink')}
        </Link>
      </div>
      <div className="flex-1">
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
          We&apos;re Vera &amp; Deniz, two folks living it up in Sofia, Bulgaria. All about good vibes,
          meaningful connections, and building rock-solid relationships.
        </p>
      </div>
    </>
  )
}
