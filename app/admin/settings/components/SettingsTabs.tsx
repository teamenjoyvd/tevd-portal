'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const TABS = [
  { value: 'email', label: 'Email' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'system', label: 'System' },
] as const

type TabValue = typeof TABS[number]['value']

interface SettingsTabsProps {
  tab: TabValue
  children: React.ReactNode
}

export function SettingsTabs({ tab, children }: SettingsTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    params.delete('page')
    router.replace(`/admin/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        {TABS.map(t => (
          <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
        ))}
      </TabsList>
      {TABS.map(t => (
        <TabsContent key={t.value} value={t.value}>
          {tab === t.value ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
