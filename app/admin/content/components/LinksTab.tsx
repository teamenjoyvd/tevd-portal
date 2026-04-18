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
import { useAdminDrawer } from '@/app/admin/components/useAdminDrawer'
import { makeDragHandlers } from './useDragSort'
import { useLanguage } from '@/lib/hooks/useLanguage'

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
  sort_order: number
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']

export function LinksTab() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const linkDrawer = useAdminDrawer<SiteLink>()
  const [linkAlertTarget, setLinkAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [lDragging, setLDragging] = useState<string | null>(null)

  const [lForm, setLForm] = useState({
    label: { en: '', bg: '' },
    url: '',
    access_roles: ['guest', 'member', 'core', 'admin'] as string[],
    sort_order: 0,
  })

  const [editLForm, setEditLForm] = useState({
    label: { en: '', bg: '' },
    url: '',
    access_roles: ['guest', 'member', 'core', 'admin'] as string[],
    sort_order: 0,
  })

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
    mutationFn: (body: typeof lForm) =>
      fetch('/api/admin/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
      setLForm({ label: { en: '', bg: '' }, url: '', access_roles: ['guest','member','core','admin'], sort_order: 0 })
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
    mutationFn: ({ id, ...body }: { id: string } & typeof editLForm) =>
      fetch(`/api/admin/links/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-links'] })
      qc.invalidateQueries({ queryKey: ['links', 'list'] })
      linkDrawer.close()
    },
  })

  function startEditingLink(l: SiteLink) {
    setEditLForm({
      label: { en: l.label.en ?? '', bg: l.label.bg ?? '' },
      url: l.url,
      access_roles: Array.isArray(l.access_roles) ? l.access_roles : ['guest','member','core','admin'],
      sort_order: l.sort_order,
    })
    linkDrawer.openEdit(l)
  }

  const lDrag = makeDragHandlers(lDragging, setLDragging, localLinks, setLocalLinks, items => reorderLinks.mutate(items))

  return (
    <section>
      {/* Inline create card — intentional exception per CLAUDE.md */}
      <div className="rounded-2xl border p-6 mb-4 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.labelEn')}</label>
            <input value={lForm.label.en} onChange={e => setLForm(f => ({ ...f, label: { ...f.label, en: e.target.value } }))}
              placeholder={t('admin.content.links.placeholder.labelEn')}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.labelBg')}</label>
            <input value={lForm.label.bg} onChange={e => setLForm(f => ({ ...f, label: { ...f.label, bg: e.target.value } }))}
              placeholder={t('admin.content.links.placeholder.labelBg')}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.url')}</label>
          <input value={lForm.url} onChange={e => setLForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://…"
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {ALL_ROLES.map(role => (
            <button key={role}
              onClick={() => setLForm(f => ({ ...f, access_roles: f.access_roles.includes(role) ? f.access_roles.filter(r => r !== role) : [...f.access_roles, role] }))}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{ backgroundColor: lForm.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: lForm.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
              {role}
            </button>
          ))}
        </div>
        <button onClick={() => createLink.mutate(lForm)}
          disabled={createLink.isPending || !lForm.label.en || !lForm.url}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {createLink.isPending ? t('admin.content.links.btn.adding') : t('admin.content.links.btn.add')}
        </button>
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

      <Drawer
        open={linkDrawer.open}
        onClose={linkDrawer.close}
        title={linkDrawer.editing ? t('admin.content.links.drawer.editTitleNamed').replace('{{name}}', linkDrawer.editing.label.en) : t('admin.content.links.drawer.editTitle')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.labelEn')}</label>
              <input value={editLForm.label.en} onChange={e => setEditLForm(f => ({ ...f, label: { ...f.label, en: e.target.value } }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.labelBg')}</label>
              <input value={editLForm.label.bg} onChange={e => setEditLForm(f => ({ ...f, label: { ...f.label, bg: e.target.value } }))}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.links.lbl.url')}</label>
            <input value={editLForm.url} onChange={e => setEditLForm(f => ({ ...f, url: e.target.value }))}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_ROLES.map(role => (
              <button key={role}
                onClick={() => setEditLForm(f => ({ ...f, access_roles: f.access_roles.includes(role) ? f.access_roles.filter(r => r !== role) : [...f.access_roles, role] }))}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{ backgroundColor: editLForm.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: editLForm.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                {role}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => linkDrawer.editing && updateLink.mutate({ id: linkDrawer.editing.id, ...editLForm })}
              disabled={updateLink.isPending || !editLForm.label.en || !editLForm.url}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {updateLink.isPending ? t('admin.content.links.btn.saving') : t('admin.content.links.btn.saveChanges')}
            </button>
            <button onClick={linkDrawer.close}
              className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
              {t('admin.content.links.btn.cancel')}
            </button>
          </div>
        </div>
      </Drawer>

      <AlertDialog open={!!linkAlertTarget} onOpenChange={open => { if (!open) setLinkAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.links.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{linkAlertTarget?.name}&rdquo;? This cannot be undone.
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
