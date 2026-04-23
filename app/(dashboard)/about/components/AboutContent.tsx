'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'

type HighlightSpec = { text: string; key: string }

function HighlightedParagraph({
  raw,
  highlights,
}: {
  raw: string
  highlights: HighlightSpec[]
}) {
  if (highlights.length === 0) {
    return (
      <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
        {raw}
      </p>
    )
  }

  // Build a regex that captures all highlight phrases (case-insensitive)
  const pattern = highlights.map(h => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const parts = raw.split(new RegExp(`(${pattern})`, 'i'))
  const lookup = Object.fromEntries(highlights.map(h => [h.text.toLowerCase(), h.key]))

  return (
    <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      {parts.map((part, i) =>
        lookup[part.toLowerCase()] ? (
          <em key={i} style={{ color: 'var(--brand-teal)', fontStyle: 'italic', fontWeight: 500 }}>
            {part}
          </em>
        ) : (
          part
        )
      )}
    </p>
  )
}

export default function AboutContent() {
  const { lang, t } = useLanguage()

  const p1Highlights: HighlightSpec[] =
    lang === 'en'
      ? [{ text: 'good vibes', key: 'gv' }]
      : [{ text: 'Добро настроение', key: 'gv' }]

  const p2Highlights: HighlightSpec[] =
    lang === 'en'
      ? [
          { text: 'meaningful connections', key: 'mc' },
          { text: 'relationships', key: 'rel' },
          { text: 'special', key: 'sp' },
        ]
      : [
          { text: 'истински връзки', key: 'mc' },
          { text: 'страст', key: 'rel' },
        ]

  return (
    <div className="flex flex-col justify-center gap-4 px-1 py-2">
      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <HighlightedParagraph raw={t('about.body1')} highlights={p1Highlights} />

      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <HighlightedParagraph raw={t('about.body2')} highlights={p2Highlights} />

      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <HighlightedParagraph raw={t('about.body3')} highlights={[]} />
    </div>
  )
}
