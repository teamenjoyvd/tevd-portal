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
import { RoleSelector } from '@/app/admin/components/RoleSelector'
import { LangTabs } from '@/app/admin/components/LangTabs'
import { I18nField } from '@/app/admin/components/I18nField'
import { formatDate } from '@/lib/format'

type Announcement = {
  id: string; titles: Record<string,string>; contents: Record<string,string>
  access_level: string[]; is_active: boolean; created_at: string; sort_order: number
}

const LANGS = ['en', 'bg', 'sk']
const ALL_ROLES = ['guest', 'member', 'core', 'admin']

function emptyI18n() {
  return Object.fromEntries(LANGS.map(l => [l, '']))
}

export function AnnouncementsTab() {
  const qc = useQueryClient()
  const announcementDrawer = useAdminDrawer<Announcement>()
  const [announcementAlertTarget, setAnnouncementAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [aDragging, setADragging] = useState<string | null>(null)
  const [aLang, setALang] = useState('en')
  const [editALang, setEditALang] = useState('en')

  const [aForm, setAForm] = useState({
    titles: emptyI18n() as Record<string,string>,
    contents: emptyI18n() as Record<string,string>,
    is_active: true,
    access_level: [...ALL_ROLES] as string[],
  })

  const [editAForm, setEditAForm] = useState({
    titles: emptyI18n() as Record<string,string>,
    contents: emptyI18n() as Record<string,string>,
    is_active: true,
    access_level: [...ALL_ROLES] as string[],
  })

  const { data: announcementsRaw = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })
  const [localAnnouncements, setLocalAnnouncements] = useState<Announcement[]>(() => [...announcementsRaw])
  const [prevAnnouncementsRaw, setPrevAnnouncementsRaw] = useState(announcementsRaw)
  if (prevAnnouncementsRaw !== announcementsRaw) {
    setPrevAnnouncementsRaw(announcementsRaw)
    setLocalAnnouncements([...announcementsRaw])
  }

  const reorderAnnouncements = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalAnnouncements([...announcementsRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const createAnnouncement = useMutation({
    mutationFn: (body: typeof aForm) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      setAForm({ titles: emptyI18n(), contents: emptyI18n(), is_active: true, access_level: [...ALL_ROLES] })
    },
  })

  const toggleAnnouncement = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const deleteAnnouncement = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })

  const updateAnnouncement = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & typeof editAForm) =>
      fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      announcementDrawer.close()
    },
  })

  function startEditingAnnouncement(a: Announcement) {
    setEditAForm({
      titles: { ...emptyI18n(), ...a.titles },
      contents: { ...emptyI18n(), ...a.contents },
      is_active: a.is_active,
      access_level: Array.isArray(a.access_level) ? a.access_level : [...ALL_ROLES],
    })
    setEditALang('en')
    announcementDrawer.openEdit(a)
  }

  const aDrag = makeDragHandlers(aDragging, setADragging, localAnnouncements, setLocalAnnouncements, items => reorderAnnouncements.mutate(items))

  return (
    <section>
      <div className="mb-4">
        <LangTabs langs={LANGS} active={aLang} onChange={setALang} />
      </div>

      {/* Inline create card — intentional exception per CLAUDE.md */}
      <div className="rounded-2xl border p-6 mb-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <I18nField
          activeLang={aLang}
          values={aForm.titles}
          onChange={(lang, val) => setAForm(f => ({ ...f, titles: { ...f.titles, [lang]: val } }))}
          placeholder="Title"
        />
        <I18nField
          activeLang={aLang}
          values={aForm.contents}
          onChange={(lang, val) => setAForm(f => ({ ...f, contents: { ...f.contents, [lang]: val } }))}
          placeholder="Content"
          multiline
        />
        <RoleSelector
          roles={ALL_ROLES}
          selected={aForm.access_level}
          onChange={access_level => setAForm(f => ({ ...f, access_level }))}
        />
        <button onClick={() => createAnnouncement.mutate(aForm)}
          disabled={createAnnouncement.isPending || !aForm.titles.en}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {createAnnouncement.isPending ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      <div className="space-y-1.5">
        {localAnnouncements.map(a => (
          <AdminListCard
            key={a.id}
            grip
            title={a.titles.en ?? a.titles.bg ?? 'Untitled'}
            sub={formatDate(a.created_at)}
            dragging={aDrag.isDragging(a.id)}
            onDragStart={() => aDrag.onDragStart(a.id)}
            onDragOver={e => aDrag.onDragOver(e, a.id)}
            onDrop={aDrag.onDrop}
            onDragEnd={aDrag.onDragEnd}
            actions={
              <>
                <button onClick={() => startEditingAnnouncement(a)}
                  className="text-xs px-2.5 py-1 rounded-full font-medium border hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                <button onClick={() => toggleAnnouncement.mutate({ id: a.id, is_active: !a.is_active })}>
                  <AdminStatusBadge variant={a.is_active ? 'active' : 'inactive'} label={a.is_active ? 'Active' : 'Inactive'} />
                </button>
                <button
                  onClick={() => setAnnouncementAlertTarget({ id: a.id, name: a.titles.en ?? a.titles.bg ?? 'Untitled' })}
                  className="text-xs font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}>Delete</button>
              </>
            }
          />
        ))}
      </div>

      <Drawer open={announcementDrawer.open} onClose={announcementDrawer.close} title="Edit announcement">
        <div className="space-y-3">
          <LangTabs langs={LANGS} active={editALang} onChange={setEditALang} />
          <I18nField
            activeLang={editALang}
            values={editAForm.titles}
            onChange={(lang, val) => setEditAForm(f => ({ ...f, titles: { ...f.titles, [lang]: val } }))}
            placeholder="Title"
          />
          <I18nField
            activeLang={editALang}
            values={editAForm.contents}
            onChange={(lang, val) => setEditAForm(f => ({ ...f, contents: { ...f.contents, [lang]: val } }))}
            placeholder="Content"
            multiline
          />
          <RoleSelector
            roles={ALL_ROLES}
            selected={editAForm.access_level}
            onChange={access_level => setEditAForm(f => ({ ...f, access_level }))}
          />
          <div className="flex gap-3 pt-2">
            <button onClick={() => announcementDrawer.editing && updateAnnouncement.mutate({ id: announcementDrawer.editing.id, ...editAForm })}
              disabled={updateAnnouncement.isPending || !editAForm.titles.en}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--brand-crimson)' }}>
              {updateAnnouncement.isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={announcementDrawer.close}
              className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
          </div>
        </div>
      </Drawer>

      <AlertDialog open={!!announcementAlertTarget} onOpenChange={open => { if (!open) setAnnouncementAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{announcementAlertTarget?.name}&rdquo;? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (announcementAlertTarget) deleteAnnouncement.mutate(announcementAlertTarget.id)
                setAnnouncementAlertTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
