'use client'

import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { translate } from '@/lib/i18n/translations'
import type { Lang } from '@/lib/i18n/translations'
import PageHeading from '@/components/layout/PageHeading'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'

type Announcement = {
  id: string
  titles: Record<string, string>
  contents: Record<string, string>
  is_active: boolean
  created_at: string
}

function timeAgo(dateStr: string, lang: Lang): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return translate('time.justNow', lang)
  if (mins < 60)  return translate('time.minsAgo', lang).replace('{n}', String(mins))
  if (hours < 24) return translate('time.hoursAgo', lang).replace('{n}', String(hours))
  return translate('time.daysAgo', lang).replace('{n}', String(days))
}

export default function AnnouncementsPage() {
  const { lang, t } = useLanguage()

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements', 'public'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })

  const active = announcements.filter(a => a.is_active)

  return (
    <>
      <PageHeading title={t('ann.title')} subtitle={t('ann.subtitle')} />
      <div className="py-8 pb-16">
        <BentoGrid>
          {isLoading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <BentoCard key={i} variant="default" colSpan={12}>
                  <div className="h-24 rounded-xl animate-pulse"
                    style={{ backgroundColor: 'var(--border-default)' }} />
                </BentoCard>
              ))}
            </>
          ) : active.length === 0 ? (
            <BentoCard variant="default" colSpan={12}>
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('ann.empty')}
                </p>
              </div>
            </BentoCard>
          ) : (
            <>
              {active.map(a => {
                const title   = a.titles[lang]   ?? a.titles.en   ?? a.titles.bg ?? ''
                const content = a.contents[lang] ?? a.contents.en ?? a.contents.bg ?? ''
                return (
                  <BentoCard key={a.id} variant="edge-info" colSpan={12}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h2 className="font-display text-xl font-semibold leading-snug"
                        style={{ color: 'var(--text-primary)' }}>
                        {title}
                      </h2>
                      <span className="text-xs flex-shrink-0 mt-1"
                        style={{ color: 'var(--text-secondary)' }}>
                        {timeAgo(a.created_at, lang)}
                      </span>
                    </div>
                    {content && (
                      <p className="text-sm leading-relaxed font-body"
                        style={{ color: 'var(--text-secondary)' }}>
                        {content}
                      </p>
                    )}
                  </BentoCard>
                )
              })}
            </>
          )}
        </BentoGrid>
      </div>
    </>
  )
}
