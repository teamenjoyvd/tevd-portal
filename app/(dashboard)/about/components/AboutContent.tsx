'use client'

import { useLanguage } from '@/lib/hooks/useLanguage'
import type { Lang } from '@/lib/i18n'

type HighlightSpec = { text: string; key: string }

// Static lookup keyed by lang — defined at module scope to avoid
// re-allocation on every render.
const P1_HIGHLIGHTS: Record<Lang, HighlightSpec[]> = {
  en: [{ text: 'good vibes', key: 'gv' }],
  bg: [{ text: 'Добро настроение', key: 'gv' }],
}

const P2_HIGHLIGHTS: Record<Lang, HighlightSpec[]> = {
  en: [
    { text: 'meaningful connections', key: 'mc' },
    { text: 'relationships', key: 'rel' },
  ],
  bg: [
    { text: 'истински връзки', key: 'mc' },
    { text: 'страст', key: 'rel' },
  ],
}

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

  // Sort longest first so multi-word phrases match before constituent words.
  const pattern = [...highlights]
    .sort((a, b) => b.text.length - a.text.length)
    .map(h => h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const parts = raw.split(new RegExp(`(${pattern})`, 'i'))
  const lookup = Object.fromEntries(highlights.map(h => [h.text.toLowerCase(), h.key]))

  return (
    <p className="text-sm leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      {parts.map((part, i) =>
        part.toLowerCase() in lookup ? (
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

  return (
    <div className="flex flex-col justify-center gap-4 px-1 py-2">
      <HighlightedParagraph raw={t('about.body1')} highlights={P1_HIGHLIGHTS[lang]} />

      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <HighlightedParagraph raw={t('about.body2')} highlights={P2_HIGHLIGHTS[lang]} />

      <div
        className="h-px w-8 rounded-full"
        style={{ backgroundColor: 'var(--brand-crimson)', opacity: 0.4 }}
      />
      <HighlightedParagraph raw={t('about.body3')} highlights={[]} />
    </div>
  )
}
