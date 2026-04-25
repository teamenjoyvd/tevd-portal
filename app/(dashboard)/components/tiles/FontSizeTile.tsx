'use client'

import { useState } from 'react'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'
import { useLanguage } from '@/lib/hooks/useLanguage'

const STEPS: { value: FontSize; label: string; iconSize: number }[] = [
  { value: 'md', label: 'Default', iconSize: 18 },
  { value: 'lg', label: 'Large',   iconSize: 24 },
  { value: 'xl', label: 'Larger',  iconSize: 30 },
]

function LetterAIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <text
        x="16"
        y="26"
        textAnchor="middle"
        fontSize="28"
        fontWeight="600"
        style={{ fontFamily: 'var(--font-cormorant)' }}
        fill={color}
      >
        A
      </text>
    </svg>
  )
}

export default function FontSizeTile({
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
  const { fontSize, setFontSize } = useFontSize()
  const [hoveredStep, setHoveredStep] = useState<FontSize | null>(null)
  const { t } = useLanguage()

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className="flex flex-col items-center justify-center"
      style={{ minHeight: 120, ...style }}
    >
      <Eyebrow style={{ marginBottom: '0.75rem' }}>{t('profile.textSize')}</Eyebrow>
      <div className="flex items-center justify-center gap-2">
        {STEPS.map(({ value, label, iconSize }) => {
          const active = fontSize === value
          const hovered = hoveredStep === value
          return (
            <button
              key={value}
              onClick={() => void setFontSize(value)}
              onMouseEnter={() => !active && setHoveredStep(value)}
              onMouseLeave={() => setHoveredStep(null)}
              className="w-11 h-11 flex flex-col items-center justify-center rounded-xl transition-colors"
              style={{
                backgroundColor: active
                  ? 'var(--brand-crimson)'
                  : hovered
                    ? 'var(--bg-card)'
                    : 'var(--bg-global)',
                border: active ? '1px solid transparent' : '1px solid var(--border-default)',
              }}
              aria-pressed={active}
              aria-label={`Font size: ${label}`}
            >
              <LetterAIcon
                size={iconSize}
                color={active ? 'var(--brand-parchment)' : 'var(--text-primary)'}
              />
            </button>
          )
        })}
      </div>
    </BentoCard>
  )
}
