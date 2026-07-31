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
      {/* Scroll rail — 4 triggers overflow 390px and "System" is otherwise
          unreachable. Fixed here rather than in components/ui/tabs.tsx, which
          has non-admin consumers. */}
      <div className="overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: 'none' }}>
        <TabsList className="w-max">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="flex-shrink-0">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TABS.map(t => (
        <TabsContent key={t.value} value={t.value}>
          {tab === t.value ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  )
}
