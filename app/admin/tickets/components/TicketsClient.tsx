'use client'

import { useState } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { ComplimentaryPassForm, type TicketProduct } from './ComplimentaryPassForm'

export function TicketsClient({ products, loadFailed }: { products: TicketProduct[]; loadFailed: boolean }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('admin.tickets.title')}
        </h1>
        <button
          onClick={() => setOpen(true)}
          disabled={loadFailed}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-on-accent disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.tickets.comp.open')}
        </button>
      </div>

      {loadFailed ? (
        <p className="text-sm" style={{ color: 'var(--status-alert-fg)' }} role="alert">
          {t('admin.tickets.loadError')}
        </p>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.tickets.comp.intro')}</p>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title={t('admin.tickets.comp.open')}>
        <ComplimentaryPassForm products={products} onClose={() => setOpen(false)} />
      </Drawer>
    </section>
  )
}
