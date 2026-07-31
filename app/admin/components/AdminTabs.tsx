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
  const railRef = React.useRef<HTMLDivElement>(null)

  // Keep the selected tab visible when the rail is scrolled at 390px — a tab
  // changed via ?tab= or a badge click can otherwise sit off-screen.
  React.useEffect(() => {
    railRef.current
      ?.querySelector('[data-state="active"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [value])

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      {/* Scroll rail: stays inside the admin shell padding (layout.tsx uses
          px-4 md:px-6 lg:px-8), so no negative margins — a flat -mx-4 would
          under-compensate at md/lg and clip the active pill's rounded edge.
          pb-1 leaves room for the active pill's shadow. */}
      <div ref={railRef} className="overflow-x-auto pb-1 mb-6" style={{ scrollbarWidth: 'none' }}>
        <TabsList
          className="h-auto w-max flex items-center gap-0.5 rounded-xl p-1"
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
                'flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ' +
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
      </div>
      {children}
    </Tabs>
  )
}
