'use client'

import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'
import { useFontSize, type FontSize } from '@/lib/hooks/useFontSize'

const STEPS: { value: FontSize; label: string; sublabel: string }[] = [
  { value: 'md', label: 'Default', sublabel: '16px' },
  { value: 'lg', label: '+1',      sublabel: '18px' },
  { value: 'xl', label: '+2',      sublabel: '20px' },
]

export default function FontSizeTile({
  colSpan = 2,
  rowSpan,
  halfWidthMobile,
}: {
  colSpan?: number
  rowSpan?: number
  halfWidthMobile?: boolean
}) {
  const { fontSize, setFontSize } = useFontSize()

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      rowSpan={rowSpan}
      halfWidthMobile={halfWidthMobile}
      className="flex flex-col"
      style={{ minHeight: 120 }}
    >
      <Eyebrow style={{ marginBottom: '0.75rem' }}>Text</Eyebrow>
      <div className="flex flex-col gap-1.5 flex-1 justify-center">
        {STEPS.map(({ value, label, sublabel }) => {
          const active = fontSize === value
          return (
            <button
              key={value}
              onClick={() => void setFontSize(value)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-colors"
              style={{
                backgroundColor: active ? 'var(--brand-crimson)' : 'var(--bg-global)',
                color: active ? 'var(--brand-parchment)' : 'var(--text-primary)',
              }}
              aria-pressed={active}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span
                className="text-xs"
                style={{ color: active ? 'rgba(250,248,243,0.7)' : 'var(--text-secondary)' }}
              >
                {sublabel}
              </span>
            </button>
          )
        })}
      </div>
    </BentoCard>
  )
}
