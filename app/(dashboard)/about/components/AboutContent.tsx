'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'

export default function AboutContent() {
  const { t } = useLanguage()

  const title = t('about.title')
  const titleParts = title.split('mission')
  const hasMissionWord = titleParts.length > 1

  return (
    <div className="flex flex-col justify-center gap-3 px-1 py-2">
      {/* Eyebrow */}
      <p
        className="text-[11px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--brand-crimson)' }}
      >
        {t('about.eyebrow')}
      </p>

      {/* Display title — italic teal on the word "mission" (EN only) */}
      <h1
        className="font-display text-2xl font-semibold leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {hasMissionWord ? (
          <>
            {titleParts[0]}
            <em style={{ color: 'var(--brand-teal)', fontStyle: 'italic' }}>mission</em>
            {titleParts[1]}
          </>
        ) : (
          title
        )}
      </h1>

      {/* Rule + body paragraph 1 */}
      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
        {t('about.body1')}
      </p>

      {/* Rule + body paragraph 2 */}
      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
        {t('about.body2')}
      </p>
    </div>
  )
}
