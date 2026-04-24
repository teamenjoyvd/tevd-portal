'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { NewsTab } from './components/NewsTab'
import { LinksTab } from './components/LinksTab'
import { GuidesTab } from './components/GuidesTab'
import { SocialTab } from './components/SocialTab'
import { useLanguage } from '@/lib/hooks/useLanguage'

const TABS = [
  { key: 'news',    labelKey: 'admin.content.page.tab.news'    },
  { key: 'guides',  labelKey: 'admin.content.page.tab.guides'  },
  { key: 'links',   labelKey: 'admin.content.page.tab.links'   },
  { key: 'socials', labelKey: 'admin.content.page.tab.socials' },
] as const

type TabKey = typeof TABS[number]['key']

function ContentPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useLanguage()
  const tab = (searchParams.get('tab') ?? 'news') as TabKey

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
        <TabsContent value="news"><NewsTab /></TabsContent>
        <TabsContent value="guides"><GuidesTab /></TabsContent>
        <TabsContent value="links"><LinksTab /></TabsContent>
        <TabsContent value="socials"><SocialTab /></TabsContent>
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
