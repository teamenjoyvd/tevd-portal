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
import { GuideForm, emptyGuide, type Guide } from './GuideForm'
import { useLanguage } from '@/lib/hooks/useLanguage'

export function GuidesTab() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const guideDrawer = useAdminDrawer<Guide>()
  const [guidesMutError, setGuidesMutError] = useState<string | null>(null)
  const [guideAlertTarget, setGuideAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [gDragging, setGDragging] = useState<string | null>(null)

  const { data: guidesRaw = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['admin-guides'],
    queryFn: () => fetch('/api/admin/guides').then(r => r.json()),
  })
  const [localGuides, setLocalGuides] = useState<Guide[]>(() => [...guidesRaw])
  const [prevGuidesRaw, setPrevGuidesRaw] = useState(guidesRaw)
  if (prevGuidesRaw !== guidesRaw) {
    setPrevGuidesRaw(guidesRaw)
    setLocalGuides([...guidesRaw])
  }

  const reorderGuides = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/guides', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalGuides([...guidesRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-guides'] }),
  })

  const createGuide = useMutation({
    mutationFn: (body: ReturnType<typeof emptyGuide>) =>
      fetch('/api/admin/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-guides'] }); guideDrawer.close(); setGuidesMutError(null) },
    onError: (e: Error) => setGuidesMutError(e.message),
  })

  const updateGuide = useMutation({
    mutationFn: ({ id, ...body }: Partial<Guide> & { id: string }) =>
      fetch(`/api/admin/guides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-guides'] }); guideDrawer.close(); setGuidesMutError(null) },
    onError: (e: Error) => setGuidesMutError(e.message),
  })

  const deleteGuide = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/guides/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-guides'] }),
  })

  const gDrag = makeDragHandlers(gDragging, setGDragging, localGuides, setLocalGuides, items => reorderGuides.mutate(items))

  const toggleGuidePublish = (guide: Guide) =>
    updateGuide.mutate({ id: guide.id, is_published: !guide.is_published })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {guidesRaw.length} guide{guidesRaw.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => { guideDrawer.openCreate(); setGuidesMutError(null) }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {t('admin.content.guides.btn.new')}
        </button>
      </div>

      <Drawer
        open={guideDrawer.open}
        onClose={() => { guideDrawer.close(); setGuidesMutError(null) }}
        title={guideDrawer.editing
          ? t('admin.content.guides.drawer.editTitle').replace('{{name}}', guideDrawer.editing.title.en || guideDrawer.editing.slug)
          : t('admin.content.guides.drawer.newTitle')
        }
      >
        {guideDrawer.isCreating && (
          <GuideForm
            initial={emptyGuide()}
            onSave={data => createGuide.mutate(data)}
            onCancel={() => { guideDrawer.close(); setGuidesMutError(null) }}
            isPending={createGuide.isPending}
            error={guidesMutError}
          />
        )}
        {guideDrawer.isEditing && guideDrawer.editing && (
          <GuideForm
            initial={{ slug: guideDrawer.editing.slug, title: guideDrawer.editing.title, cover_image_url: guideDrawer.editing.cover_image_url, emoji: guideDrawer.editing.emoji, body: guideDrawer.editing.body, access_roles: guideDrawer.editing.access_roles, is_published: guideDrawer.editing.is_published, sort_order: guideDrawer.editing.sort_order }}
            onSave={data => updateGuide.mutate({ id: guideDrawer.editing!.id, ...data })}
            onCancel={() => { guideDrawer.close(); setGuidesMutError(null) }}
            isPending={updateGuide.isPending}
            error={guidesMutError}
          />
        )}
      </Drawer>

      {guidesLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : guidesRaw.length === 0 ? (
        <div className="rounded-2xl border px-6 py-12 text-center" style={{ borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.guides.empty')}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {localGuides.map(guide => (
            <AdminListCard
              key={guide.id}
              grip
              lead={<span className="text-xl">{guide.emoji ?? '\uD83D\uDCC4'}</span>}
              title={guide.title.en || '(untitled)'}
              sub={`/${guide.slug} \u00B7 ${guide.access_roles.join(', ')}`}
              dragging={gDrag.isDragging(guide.id)}
              onDragStart={() => gDrag.onDragStart(guide.id)}
              onDragOver={e => gDrag.onDragOver(e, guide.id)}
              onDrop={gDrag.onDrop}
              onDragEnd={gDrag.onDragEnd}
              actions={
                <>
                  <AdminStatusBadge variant={guide.is_published ? 'active' : 'inactive'} label={guide.is_published ? 'Published' : 'Draft'} />
                  <button onClick={() => toggleGuidePublish(guide)} disabled={updateGuide.isPending}
                    className="px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    {guide.is_published ? t('admin.content.guides.btn.unpublish') : t('admin.content.guides.btn.publish')}
                  </button>
                  <button onClick={() => { guideDrawer.openEdit(guide); setGuidesMutError(null) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    {t('admin.content.guides.btn.edit')}
                  </button>
                  <button
                    onClick={() => setGuideAlertTarget({ id: guide.id, name: guide.title.en || guide.slug })}
                    disabled={deleteGuide.isPending}
                    className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-50"
                    style={{ color: 'var(--brand-crimson)' }}>
                    {t('admin.content.guides.btn.delete')}
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!guideAlertTarget} onOpenChange={open => { if (!open) setGuideAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.guides.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.content.guides.dialog.body').replace('{{name}}', guideAlertTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.content.guides.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (guideAlertTarget) deleteGuide.mutate(guideAlertTarget.id)
                setGuideAlertTarget(null)
              }}
            >
              {t('admin.content.guides.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
