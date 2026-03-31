'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { AnnouncementsTab } from './components/AnnouncementsTab'
import { LinksTab } from './components/LinksTab'
import { GuidesTab } from './components/GuidesTab'
import { SocialTab } from './components/SocialTab'
import { BentoTab } from './components/BentoTab'

const TABS = [
  { key: 'announcements', label: 'Announcements' },
  { key: 'links',         label: 'Links'         },
  { key: 'guides',        label: 'Guides'        },
  { key: 'socials',       label: 'Social Posts'  },
  { key: 'bento',         label: 'Bento'         },
] as const

type TabKey = typeof TABS[number]['key']

function ContentPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'announcements') as TabKey

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Content
        </h1>
      </div>

      <AdminTabs
        tabs={[...TABS]}
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
