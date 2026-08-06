'use client'

import BentoCard from '@/components/bento/BentoCard'
import { LocationMap } from '@/components/ui/expand-map'
import { useLanguage } from '@/lib/hooks/useLanguage'

const SOFIA_COORDS = '42.6977° N, 23.3219° E'

export default function LocationTile({
  colSpan = 6,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { t } = useLanguage()

  return (
    <BentoCard variant="forest" colSpan={colSpan} mobileColSpan={mobileColSpan} rowSpan={rowSpan}
      className="relative overflow-hidden p-0"
      style={{ minHeight: 200, border: 'none', ...style }}>
      {/* absolute, not h-full: BentoCard sets min-height, and a percentage
          height does not resolve against a parent whose height is auto. */}
      <LocationMap
        className="absolute inset-0"
        location={t('home.loc.city')}
        coordinates={SOFIA_COORDS}
        liveLabel={t('home.loc.live')}
        expandHint={t('home.loc.expand')}
      />
    </BentoCard>
  )
}
