'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '@/lib/hooks/useLanguage'

export function ProfileBackLink() {
  const { t } = useLanguage()
  return (
    <Link
      href="/profile"
      className="inline-flex items-center gap-1 text-xs font-semibold mb-3 md:mb-5 hover:opacity-70 transition-opacity"
      style={{ color: 'var(--text-secondary)' }}
    >
      <ArrowLeft size={14} />
      {t('profile.backToProfile')}
    </Link>
  )
}
