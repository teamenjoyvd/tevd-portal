'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'

const MISSION_WORD: Record<'en' | 'bg', string> = {
  en: 'mission',
  bg: '\u043c\u0438\u0441\u0438\u044f',
}

export default function AboutContent() {
  const { lang, t } = useLanguage()

  const title = t('about.title')
  const keyword = MISSION_WORD[lang]
  // Capturing group in the regex preserves the matched text in the split array,
  // and the 'i' flag makes the match case-insensitive.
  const titleParts = title.split(new RegExp(`(${keyword})`, 'i'))

  return (
    <div className="flex flex-col justify-center gap-3 px-1 py-2">
      {/* Eyebrow */}
      <p
        className="text-[11px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--brand-crimson)' }}
      >
        {t('about.eyebrow')}
      </p>

      {/* Display title — italic teal on the mission/мисия keyword */}
      <h1
        className="font-display text-2xl font-semibold leading-snug"
        style={{ color: 'var(--text-primary)' }}
      >
        {titleParts.map((part, i) =>
          part.toLowerCase() === keyword.toLowerCase() ? (
            <em key={i} style={{ color: 'var(--brand-teal)', fontStyle: 'italic' }}>{part}</em>
          ) : (
            part
          )
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
