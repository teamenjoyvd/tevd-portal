'use client'

import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'

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
        fontFamily="Georgia, serif"
        fill={color}
      >
        A
      </text>
    </svg>
  )
}

export default function FontSizeTile({
  colSpan = 2,
  rowSpan,
}: {
  colSpan?: number
  rowSpan?: number
}) {
  const { fontSize, setFontSize } = useFontSize()

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      rowSpan={rowSpan}
      className="flex flex-col"
      style={{ minHeight: 120 }}
    >
      <Eyebrow style={{ marginBottom: '0.75rem' }}>Text Size</Eyebrow>
      <div className="flex gap-2 flex-1">
        {STEPS.map(({ value, label, iconSize }) => {
          const active = fontSize === value
          return (
            <button
              key={value}
              onClick={() => void setFontSize(value)}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-colors"
              style={{
                backgroundColor: active ? 'var(--brand-crimson)' : 'var(--bg-global)',
                minHeight: 72,
              }}
              aria-pressed={active}
              aria-label={`Font size: ${label}`}
            >
              <LetterAIcon
                size={iconSize}
                color={active ? 'var(--brand-parchment)' : 'var(--text-primary)'}
              />
              <span
                className="font-body text-[10px] font-semibold tracking-wide"
                style={{
                  color: active ? 'rgba(250,248,243,0.85)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </BentoCard>
  )
}
