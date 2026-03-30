'use client'

import BentoCard, { Eyebrow, BENTO_INTERACTIVE_CLASSES } from '@/components/bento/BentoCard'
import { useTheme } from '@/lib/hooks/useTheme'

export default function ThemeTile({
  colSpan = 2,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { theme, mounted, toggle } = useTheme()

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className={`cursor-pointer select-none ${BENTO_INTERACTIVE_CLASSES} flex flex-col items-center justify-center text-center`}
      style={{ minHeight: 120, ...style }}
      onClick={toggle}
    >
      <div className="mb-3">
        {!mounted ? (
          <div
            className="w-10 h-10 rounded-full animate-pulse mx-auto"
            style={{ backgroundColor: 'var(--border-default)' }}
          />
        ) : theme === 'light' ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="var(--brand-crimson)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="var(--brand-teal)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
        )}
      </div>
      <Eyebrow>{!mounted ? '…' : theme === 'light' ? 'Light' : 'Dark'}</Eyebrow>
    </BentoCard>
  )
}
