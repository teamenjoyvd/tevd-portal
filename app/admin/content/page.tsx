'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { AnnouncementsTab } from './components/AnnouncementsTab'
import { LinksTab } from './components/LinksTab'
import { GuidesTab } from './components/GuidesTab'
import { SocialTab } from './components/SocialTab'
import { BentoTab } from './components/BentoTab'
import { useLanguage } from '@/lib/hooks/useLanguage'

const TABS = [
  { key: 'announcements', labelKey: 'admin.content.page.tab.announcements' },
  { key: 'links',         labelKey: 'admin.content.page.tab.links'         },
  { key: 'guides',        labelKey: 'admin.content.page.tab.guides'        },
  { key: 'socials',       labelKey: 'admin.content.page.tab.socials'       },
  { key: 'bento',         labelKey: 'admin.content.page.tab.bento'         },
] as const

type TabKey = typeof TABS[number]['key']

function ContentPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useLanguage()
  const tab = (searchParams.get('tab') ?? 'announcements') as TabKey

  const tabs = TABS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('admin.content.page.heading')}
        </h1>
      </div>

      <AdminTabs
        tabs={tabs}
        value={tab}
        onValueChange={(val) => router.replace(`?tab=${val}`, { scroll: false })}
      >
        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="links"><LinksTab /></TabsContent>
        <TabsContent value="guides"><GuidesTab /></TabsContent>
        <TabsContent value="socials"><SocialTab /></TabsContent>
        <TabsContent value="bento"><BentoTab /></TabsContent>
      </AdminTabs>
    </div>
  )
}

export default function ContentPage() {
  return (
    <Suspense>
      <ContentPageInner />
    </Suspense>
  )
}
