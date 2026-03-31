'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export type AdminTabItem = {
  key: string
  label: string
  badge?: number
}

type AdminTabsProps = {
  tabs: AdminTabItem[]
  value: string
  onValueChange: (val: string) => void
  children: React.ReactNode
}

export { TabsContent }

export default function AdminTabs({ tabs, value, onValueChange, children }: AdminTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList
        className="h-auto flex items-center gap-0.5 rounded-xl p-1 mb-6"
        style={{
          backgroundColor: 'var(--bg-global)',
          border: '1px solid var(--border-default)',
        }}
      >
        {tabs.map(tab => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            className={
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
              // inactive base
              'text-[var(--text-secondary)] bg-transparent ' +
              // inactive hover — forest tint
              'hover:bg-[rgba(45,51,42,0.07)] hover:text-[var(--text-primary)] ' +
              // active — forest fill, parchment text, no extra hover
              'data-[state=active]:bg-[var(--brand-forest)] data-[state=active]:text-[var(--brand-parchment)] ' +
              'data-[state=active]:shadow-sm data-[state=active]:hover:bg-[var(--brand-forest)] ' +
              'data-[state=active]:hover:text-[var(--brand-parchment)]'
            }
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none"
                style={{ backgroundColor: 'var(--brand-crimson)', color: 'white' }}
              >
                {tab.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  )
}
