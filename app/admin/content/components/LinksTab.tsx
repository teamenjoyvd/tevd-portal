'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { useLanguage } from '@/lib/hooks/useLanguage'
import { LinkForm, ALL_ROLES } from './LinkForm'
import { LinkEditDrawer } from './LinkEditDrawer'
import type { LinkFormData } from './LinkForm'

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
  sort_order: number
  is_active: boolean
}

const DEFAULT_FORM: LinkFormData = {
  label: { en: '', bg: '' },
  url: '',
  access_roles: [...ALL_ROLES],
}

export function LinksTab() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const linkDrawer = useAdminDrawer<SiteLink>()
  const [linkAlertTarget, setLinkAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [lDragging, setLDragging] = useState<string | null>(null)
  const [editInitial, setEditInitial] = useState<LinkFormData>(DEFAULT_FORM)
  const [createKey, setCreateKey] = useState(0)

  const { data: linksRaw = [] } = useQuery<SiteLink[]>({
    queryKey: ['admin-links'],
    queryFn: () => fetch('/api/admin/links').then(r => r.json()),
  })
  const [localLinks, setLocalLinks] = useState<SiteLink[]>(() => [...linksRaw])
  const [prevLinksRaw, setPrevLinksRaw] = useState(linksRaw)
  if (prevLinksRaw !== linksRaw) {
    setPrevLinksRaw(linksRaw)
    setLocalLinks([...linksRaw])
  }

  const reorderLinks = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalLinks([...linksRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-links'] }),
  })

  const createLink = useMutation({
    mutationFn: (data: LinkFormData) =>
      fetch('/api/admin/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
      setCreateKey(k => k + 1)
    },
  })

  const deleteLink = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/links/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
    },
  })

  const updateLink = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & LinkFormData) =>
      fetch(`/api/admin/links/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
      linkDrawer.close()
    },
  })

  const toggleLinkActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetch(`/api/admin/links/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
    },
  })

  function startEditingLink(l: SiteLink) {
    setEditInitial({
      label: { en: l.label.en ?? '', bg: l.label.bg ?? '' },
      url: l.url,
      access_roles: Array.isArray(l.access_roles) ? l.access_roles : [...ALL_ROLES],
    })
    linkDrawer.openEdit(l)
  }

  const lDrag = makeDragHandlers(lDragging, setLDragging, localLinks, setLocalLinks, items => reorderLinks.mutate(items))

  return (
    <section>
      {/* Inline create card — intentional exception per CLAUDE.md */}
      <div className="rounded-2xl border p-6 mb-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <LinkForm
          key={createKey}
          initial={DEFAULT_FORM}
          onSave={data => createLink.mutate(data)}
          isPending={createLink.isPending}
          submitLabel={createLink.isPending ? t('admin.content.links.btn.adding') : t('admin.content.links.btn.add')}
        />
      </div>

      <div className="space-y-1.5">
        {localLinks.map(l => (
          <AdminListCard
            key={l.id}
            grip
            title={l.label.en}
            sub={l.url}
            dragging={lDrag.isDragging(l.id)}
            onDragStart={() => lDrag.onDragStart(l.id)}
            onDragOver={e => lDrag.onDragOver(e, l.id)}
            onDrop={lDrag.onDrop}
            onDragEnd={lDrag.onDragEnd}
            actions={
              <>
                <button onClick={() => startEditingLink(l)}
                  className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                  {t('admin.content.links.btn.edit')}
                </button>
                <button onClick={() => toggleLinkActive.mutate({ id: l.id, is_active: !l.is_active })}>
                  <AdminStatusBadge
                    variant={l.is_active ? 'active' : 'inactive'}
                    label={l.is_active ? t('admin.content.links.btn.toggleActive') : t('admin.content.links.btn.toggleInactive')}
                  />
                </button>
                <button
                  onClick={() => setLinkAlertTarget({ id: l.id, name: l.label.en })}
                  className="text-xs font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}>
                  {t('admin.content.links.btn.delete')}
                </button>
              </>
            }
          />
        ))}
        {localLinks.length === 0 && (
          <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.empty')}</p>
          </div>
        )}
      </div>

      <LinkEditDrawer
        key={linkDrawer.editing?.id ?? 'new'}
        open={linkDrawer.open}
        onClose={linkDrawer.close}
        title={linkDrawer.editing
          ? t('admin.content.links.drawer.editTitleNamed').replace('{{name}}', linkDrawer.editing.label.en)
          : t('admin.content.links.drawer.editTitle')
        }
        initial={editInitial}
        onSave={data => linkDrawer.editing && updateLink.mutate({ id: linkDrawer.editing.id, ...data })}
        isPending={updateLink.isPending}
        submitLabel={updateLink.isPending ? t('admin.content.links.btn.saving') : t('admin.content.links.btn.saveChanges')}
      />

      <AlertDialog open={!!linkAlertTarget} onOpenChange={open => { if (!open) setLinkAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.links.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.content.links.dialog.body').replace('{{name}}', linkAlertTarget?.name ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.content.links.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (linkAlertTarget) deleteLink.mutate(linkAlertTarget.id)
                setLinkAlertTarget(null)
              }}
            >
              {t('admin.content.links.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
