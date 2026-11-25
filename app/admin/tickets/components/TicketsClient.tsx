'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { ComplimentaryPassForm, type TicketProduct } from './ComplimentaryPassForm'
import { AttentionTab, OrdersTab, PassesTab, SessionsTab } from './TicketLists'

const TABS = ['passes', 'orders', 'sessions', 'attention'] as const
type Props = { products: TicketProduct[]; loadFailed: boolean }

export function TicketsClient(props: Props) {
  return (
    <Suspense>
      <TicketsInner {...props} />
    </Suspense>
  )
}

function TicketsInner({ products, loadFailed }: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const wanted = useSearchParams().get('tab')
  const tab = TABS.find((k) => k === wanted) ?? 'passes'

  return (
    <section className="space-y-6">
      <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {t('admin.tickets.title')}
      </h1>
      <AdminTabs
        tabs={TABS.map((key) => ({ key, label: t(`admin.tickets.tab.${key}`) }))}
        value={tab}
        onValueChange={(val) => router.replace(`?tab=${val}`, { scroll: false })}
      >
        <TabsContent value="passes" className="space-y-6">
          <IssueFreePass products={products} loadFailed={loadFailed} />
          <PassesTab />
        </TabsContent>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="sessions"><SessionsTab /></TabsContent>
        <TabsContent value="attention"><AttentionTab /></TabsContent>
      </AdminTabs>
    </section>
  )
}

function IssueFreePass({ products, loadFailed }: Props) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        disabled={loadFailed}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--brand-crimson)', minHeight: 44 }}
      >
        {t('admin.tickets.comp.open')}
      </button>
      {loadFailed ? (
        <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }} role="alert">{t('admin.tickets.loadError')}</p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.tickets.comp.intro')}</p>
      )}
      <Drawer open={open} onClose={() => setOpen(false)} title={t('admin.tickets.comp.open')}>
        <ComplimentaryPassForm products={products} onClose={() => setOpen(false)} />
      </Drawer>
    </div>
  )
}
