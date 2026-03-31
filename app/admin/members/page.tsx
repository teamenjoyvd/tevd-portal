'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { MembersTab } from './components/MembersTab'
import { LosTab } from './components/LosTab'
import { DataCenterTab } from './components/DataCenterTab'

const TABS = [
  { key: 'members',     label: 'Members'     },
  { key: 'los',         label: 'LOS Tree'    },
  { key: 'data-center', label: 'Data Center' },
] as const

type TabKey = typeof TABS[number]['key']

function AdminMembersInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'members') as TabKey

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        Members
      </h1>
      <AdminTabs
        tabs={[...TABS]}
        value={tab}
        onValueChange={val => router.replace(`?tab=${val}`, { scroll: false })}
      >
        <TabsContent value="members"><MembersTab /></TabsContent>
        <TabsContent value="los"><LosTab /></TabsContent>
        <TabsContent value="data-center"><DataCenterTab /></TabsContent>
      </AdminTabs>
    </div>
  )
}

export default function AdminMembersPage() {
  return (
    <Suspense>
      <AdminMembersInner />
    </Suspense>
  )
}
