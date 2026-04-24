'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/Drawer'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { AdminListCard } from '@/app/admin/components/AdminListCard'
import { AdminStatusBadge } from '@/app/admin/components/AdminStatusBadge'
import { useAdminDrawer } from '@/app/admin/components/useAdminDrawer'
import { makeDragHandlers } from './useDragSort'
import { NewsForm, emptyNewsItem, type NewsItem } from './NewsForm'
import { formatDate } from '@/lib/format'
import { useLanguage } from '@/lib/hooks/useLanguage'

export function NewsTab() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const newsDrawer = useAdminDrawer<NewsItem>()
  const [alertTarget, setAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const { data: rawItems = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })
  const [localItems, setLocalItems] = useState<NewsItem[]>(() => [...rawItems])
  const [prevRaw, setPrevRaw] = useState(rawItems)
  if (prevRaw !== rawItems) {
    setPrevRaw(rawItems)
    setLocalItems([...rawItems])
  }

  const reorder = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalItems([...rawItems]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const createItem = useMutation({
    mutationFn: (body: Omit<NewsItem, 'id' | 'created_at'>) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      newsDrawer.close()
    },
  })

  const toggleItem = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const deleteItem = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const updateItem = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Omit<NewsItem, 'id' | 'created_at'>) =>
      fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      newsDrawer.close()
    },
  })

  const drag = makeDragHandlers(dragging, setDragging, localItems, setLocalItems, items => reorder.mutate(items))

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {rawItems.length} post{rawItems.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => newsDrawer.openCreate()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {t('admin.content.news.btn.new')}
        </button>
      </div>

      <Drawer
        open={newsDrawer.open}
        onClose={newsDrawer.close}
        title={
          newsDrawer.editing
            ? t('admin.content.news.drawer.editTitle').replace('{{name}}', newsDrawer.editing.titles.en || '')
            : t('admin.content.news.drawer.newTitle')
        }
      >
        {newsDrawer.isCreating && (
          <NewsForm
            initial={emptyNewsItem()}
            onSave={data => createItem.mutate(data)}
            onCancel={newsDrawer.close}
            isPending={createItem.isPending}
          />
        )}
        {newsDrawer.isEditing && newsDrawer.editing && (
          <NewsForm
            initial={{
              titles: newsDrawer.editing.titles,
              contents: newsDrawer.editing.contents,
              access_roles: newsDrawer.editing.access_roles,
              is_active: newsDrawer.editing.is_active,
              sort_order: newsDrawer.editing.sort_order,
              slug: newsDrawer.editing.slug,
            }}
            onSave={data => updateItem.mutate({ id: newsDrawer.editing!.id, ...data })}
            onCancel={newsDrawer.close}
            isPending={updateItem.isPending}
          />
        )}
      </Drawer>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : rawItems.length === 0 ? (
        <div className="rounded-2xl border px-6 py-12 text-center" style={{ borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.news.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {localItems.map(item => (
            <AdminListCard
              key={item.id}
              grip
              title={item.titles.en ?? item.titles.bg ?? 'Untitled'}
              sub={formatDate(item.created_at)}
              dragging={drag.isDragging(item.id)}
              onDragStart={() => drag.onDragStart(item.id)}
              onDragOver={e => drag.onDragOver(e, item.id)}
              onDrop={drag.onDrop}
              onDragEnd={drag.onDragEnd}
              actions={
                <>
                  <button
                    onClick={() => newsDrawer.openEdit(item)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium border hover:bg-black/5 transition-colors"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                  >
                    {t('admin.content.news.btn.edit')}
                  </button>
                  <button onClick={() => toggleItem.mutate({ id: item.id, is_active: !item.is_active })}>
                    <AdminStatusBadge variant={item.is_active ? 'active' : 'inactive'} label={item.is_active ? 'Active' : 'Inactive'} />
                  </button>
                  <button
                    onClick={() => setAlertTarget({ id: item.id, name: item.titles.en ?? item.titles.bg ?? 'Untitled' })}
                    className="text-xs font-medium hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--brand-crimson)' }}
                  >
                    {t('admin.content.news.btn.delete')}
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!alertTarget} onOpenChange={open => { if (!open) setAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.news.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.content.news.dialog.body').replace('{{name}}', alertTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.content.news.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (alertTarget) deleteItem.mutate(alertTarget.id)
                setAlertTarget(null)
              }}
            >
              {t('admin.content.news.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
