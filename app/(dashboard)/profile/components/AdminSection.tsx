'use client'

import { Shield } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { BentoHeader } from './BentoHeader'

export function AdminSection() {
  const { t } = useLanguage()
  return (
    <div>
      <BentoHeader icon={Shield} title={t('profile.adminTools')} tone="teal" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '12px' }}>
        <a href="/admin"
          style={{ gridColumn: 'span 2', backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
          className="rounded-xl px-4 py-3 flex flex-col gap-1 hover:opacity-80 transition-opacity">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand-parchment)' }}>{t('profile.adminTools.admin')}</span>
          <span className="text-[10px] opacity-60" style={{ color: 'var(--brand-parchment)' }}>{t('profile.adminTools.portalManagement')}</span>
        </a>
      </div>
    </div>
  )
}
