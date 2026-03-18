'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBentoConfig, type BentoConfigEntry } from '@/lib/hooks/useBentoConfig'

const TILE_LABELS: Record<string, string> = {
  events:        'Events tile',
  trips:         'Trips tile',
  announcements: 'Announcements tile',
  howtos:        'Howtos tile',
  links:         'Quick Links tile',
}

function BentoSettings() {
  const qc = useQueryClient()
  const { data: config = [], isLoading } = useBentoConfig()
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)

  const values: Record<string, number> = {}
  config.forEach(e => { values[e.tile_key] = draft[e.tile_key] ?? e.max_items })

  const saveMutation = useMutation({
    mutationFn: (updates: BentoConfigEntry[]) =>
      fetch('/api/admin/bento-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bento-config'] })
      setDraft({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  function handleSave() {
    const updates = Object.entries(draft).map(([tile_key, max_items]) => ({ tile_key, max_items }))
    if (updates.length > 0) saveMutation.mutate(updates)
  }

  const isDirty = Object.keys(draft).length > 0

  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Bento settings
      </h2>
      <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
          Maximum number of items shown per tile on the homepage.
        </p>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {config.map(entry => (
              <div key={entry.tile_key} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {TILE_LABELS[entry.tile_key] ?? entry.tile_key}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={values[entry.tile_key] ?? entry.max_items}
                  onChange={e => setDraft(d => ({ ...d, [entry.tile_key]: Number(e.target.value) }))}
                  className="w-20 border rounded-xl px-3 py-2 text-sm text-center"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="mt-5 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </section>
  )
}

type Announcement = {
  id: string; titles: Record<string,string>; contents: Record<string,string>
  access_level: string[]; is_active: boolean; created_at: string
}
type QuickLink = {
  id: string; label: string; url: string; icon_name: string
  access_level: string[]; sort_order: number
}
type HomeSettings = {
  id: string
  show_caret_1: boolean; caret_1_text: string
  show_caret_2: boolean; caret_2_text: string
  show_caret_3: boolean; caret_3_text: string
  featured_announcement_id: string | null
}

const LANGS = ['en', 'bg', 'sk']

export default function ContentPage() {
  const qc = useQueryClient()

  // ── Announcements ──────────────────────────────────────────
  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })

  const [aForm, setAForm] = useState({
    titles: { en: '', bg: '', sk: '' } as Record<string,string>,
    contents: { en: '', bg: '', sk: '' } as Record<string,string>,
    is_active: true,
    access_level: ['guest', 'member', 'core', 'admin'] as string[],
  })
  const [aLang, setALang] = useState('en')

  const createAnnouncement = useMutation({
    mutationFn: (body: typeof aForm) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      setAForm({ titles: { en:'',bg:'',sk:'' }, contents: { en:'',bg:'',sk:'' }, is_active: true, access_level: ['guest','member','core','admin'] })
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

  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [editAForm, setEditAForm] = useState({
    titles: { en: '', bg: '', sk: '' } as Record<string,string>,
    contents: { en: '', bg: '', sk: '' } as Record<string,string>,
    is_active: true,
    access_level: ['guest', 'member', 'core', 'admin'] as string[],
  })
  const [editALang, setEditALang] = useState('en')

  const updateAnnouncement = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & typeof editAForm) =>
      fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] })
      setEditingAnnouncement(null)
    },
  })

  function startEditingAnnouncement(a: Announcement) {
    setEditAForm({
      titles: { en: '', bg: '', sk: '', ...a.titles },
      contents: { en: '', bg: '', sk: '', ...a.contents },
      is_active: a.is_active,
      access_level: Array.isArray(a.access_level) ? a.access_level : ['guest','member','core','admin'],
    })
    setEditALang('en')
    setEditingAnnouncement(a)
  }

  // ── Quick Links ────────────────────────────────────────────
  const { data: links = [] } = useQuery<QuickLink[]>({
    queryKey: ['quick-links'],
    queryFn: () => fetch('/api/admin/quick-links').then(r => r.json()),
  })

  const [lForm, setLForm] = useState({ label: '', url: '', icon_name: 'link', sort_order: 0, access_level: ['guest','member','core','admin'] as string[] })

  const createLink = useMutation({
    mutationFn: (body: typeof lForm) =>
      fetch('/api/admin/quick-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-links'] })
      setLForm({ label: '', url: '', icon_name: 'link', sort_order: 0, access_level: ['guest','member','core','admin'] })
    },
  })

  const deleteLink = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/quick-links/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-links'] }),
  })

  const [editingLink, setEditingLink] = useState<QuickLink | null>(null)
  const [editLForm, setEditLForm] = useState({ label: '', url: '', icon_name: 'link', sort_order: 0, access_level: ['guest','member','core','admin'] as string[] })

  const updateLink = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & typeof editLForm) =>
      fetch(`/api/admin/quick-links/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-links'] })
      setEditingLink(null)
    },
  })

  function startEditingLink(l: QuickLink) {
    setEditLForm({
      label: l.label,
      url: l.url,
      icon_name: l.icon_name,
      sort_order: l.sort_order,
      access_level: Array.isArray(l.access_level) ? l.access_level : ['guest','member','core','admin'],
    })
    setEditingLink(l)
  }

  // ── Home Settings ──────────────────────────────────────────
  const { data: settings } = useQuery<HomeSettings>({
    queryKey: ['home-settings'],
    queryFn: () => fetch('/api/admin/home-settings').then(r => r.json()),
  })

  const [sForm, setSForm] = useState<Partial<HomeSettings>>({})
  const s = { ...settings, ...sForm }

  const saveSettings = useMutation({
    mutationFn: (body: Partial<HomeSettings>) =>
      fetch('/api/admin/home-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['home-settings'] })
      setSForm({})
    },
  })

  return (
    <div className="space-y-12">

      {/* ── Home Settings ── */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Home settings
        </h2>
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 space-y-4">
          {([1,2,3] as const).map(n => (
            <div key={n} className="flex items-center gap-4">
              <input
                type="checkbox"
                checked={!!s[`show_caret_${n}` as keyof HomeSettings]}
                onChange={e => setSForm(f => ({ ...f, [`show_caret_${n}`]: e.target.checked }))}
                className="w-4 h-4 accent-[var(--brand-crimson)]"
              />
              <label className="text-sm w-16" style={{ color: 'var(--text-secondary)' }}>Caret {n}</label>
              <input
                value={String(s[`caret_${n}_text` as keyof HomeSettings] ?? '')}
                onChange={e => setSForm(f => ({ ...f, [`caret_${n}_text`]: e.target.value }))}
                placeholder={`Caret ${n} text`}
                className="flex-1 border border-black/10 rounded-xl px-3 py-2 text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          ))}
          <button
            onClick={() => saveSettings.mutate(sForm)}
            disabled={saveSettings.isPending || Object.keys(sForm).length === 0}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {saveSettings.isPending ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>

      {/* ── Announcements ── */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Announcements
        </h2>

        <div className="flex gap-2 mb-4">
          {LANGS.map(l => (
            <button key={l} onClick={() => setALang(l)}
              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: aLang === l ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                color: aLang === l ? 'white' : 'var(--text-secondary)',
              }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-4 space-y-3">
          <input
            value={aForm.titles[aLang] ?? ''}
            onChange={e => setAForm(f => ({ ...f, titles: { ...f.titles, [aLang]: e.target.value } }))}
            placeholder={`Title (${aLang.toUpperCase()})`}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
            style={{ color: 'var(--text-primary)' }}
          />
          <textarea
            value={aForm.contents[aLang] ?? ''}
            onChange={e => setAForm(f => ({ ...f, contents: { ...f.contents, [aLang]: e.target.value } }))}
            placeholder={`Content (${aLang.toUpperCase()})`}
            rows={4}
            className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="flex gap-2 flex-wrap">
            {['guest','member','core','admin'].map(role => (
              <button key={role}
                onClick={() => setAForm(f => ({
                  ...f,
                  access_level: f.access_level.includes(role)
                    ? f.access_level.filter(r => r !== role)
                    : [...f.access_level, role],
                }))}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: aForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                  color: aForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                }}>
                {role}
              </button>
            ))}
          </div>
          <button
            onClick={() => createAnnouncement.mutate(aForm)}
            disabled={createAnnouncement.isPending || !aForm.titles.en}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {createAnnouncement.isPending ? 'Publishing…' : 'Publish'}
          </button>
        </div>

        <div className="space-y-2">
          {announcements.map(a => (
            <div key={a.id}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {a.titles.en ?? a.titles.bg ?? 'Untitled'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startEditingAnnouncement(a)}
                  className="text-xs px-2.5 py-1 rounded-full font-medium border hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleAnnouncement.mutate({ id: a.id, is_active: !a.is_active })}
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: a.is_active ? '#81b29a33' : 'rgba(0,0,0,0.05)',
                    color: a.is_active ? '#2d6a4f' : 'var(--text-secondary)',
                  }}
                >
                  {a.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => deleteAnnouncement.mutate(a.id)}
                  className="text-xs font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingAnnouncement && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                Edit announcement
              </p>
              <button onClick={() => setEditingAnnouncement(null)}
                className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              {LANGS.map(l => (
                <button key={l} onClick={() => setEditALang(l)}
                  className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: editALang === l ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
                    color: editALang === l ? 'white' : 'var(--text-secondary)',
                  }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <input
              value={editAForm.titles[editALang] ?? ''}
              onChange={e => setEditAForm(f => ({ ...f, titles: { ...f.titles, [editALang]: e.target.value } }))}
              placeholder={`Title (${editALang.toUpperCase()})`}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            <textarea
              value={editAForm.contents[editALang] ?? ''}
              onChange={e => setEditAForm(f => ({ ...f, contents: { ...f.contents, [editALang]: e.target.value } }))}
              placeholder={`Content (${editALang.toUpperCase()})`}
              rows={4}
              className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2 flex-wrap">
              {['guest','member','core','admin'].map(role => (
                <button key={role}
                  onClick={() => setEditAForm(f => ({
                    ...f,
                    access_level: f.access_level.includes(role)
                      ? f.access_level.filter(r => r !== role)
                      : [...f.access_level, role],
                  }))}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: editAForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                    color: editAForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                  }}>
                  {role}
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => updateAnnouncement.mutate({ id: editingAnnouncement.id, ...editAForm })}
                disabled={updateAnnouncement.isPending || !editAForm.titles.en}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {updateAnnouncement.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditingAnnouncement(null)}
                className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Quick Links ── */}
      <section>
        <h2 className="font-display text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Quick links
        </h2>
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-4">
          <div className="grid grid-cols-4 gap-3 mb-4">
            <input value={lForm.label}
              onChange={e => setLForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Label"
              className="border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)' }} />
            <input value={lForm.url}
              onChange={e => setLForm(f => ({ ...f, url: e.target.value }))}
              placeholder="URL"
              className="border border-black/10 rounded-xl px-3 py-2.5 text-sm col-span-2"
              style={{ color: 'var(--text-primary)' }} />
            <input value={lForm.icon_name}
              onChange={e => setLForm(f => ({ ...f, icon_name: e.target.value }))}
              placeholder="Icon name"
              className="border border-black/10 rounded-xl px-3 py-2.5 text-sm"
              style={{ color: 'var(--text-primary)' }} />
          </div>
          <div className="flex gap-2 flex-wrap mb-4">
            {['guest','member','core','admin'].map(role => (
              <button key={role}
                onClick={() => setLForm(f => ({
                  ...f,
                  access_level: f.access_level.includes(role)
                    ? f.access_level.filter(r => r !== role)
                    : [...f.access_level, role],
                }))}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: lForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                  color: lForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                }}>
                {role}
              </button>
            ))}
          </div>
          <button
            onClick={() => createLink.mutate(lForm)}
            disabled={createLink.isPending || !lForm.label || !lForm.url}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            {createLink.isPending ? 'Adding…' : 'Add link'}
          </button>
        </div>
        <div className="space-y-2">
          {links.map(l => (
            <div key={l.id}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{l.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{l.url}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => startEditingLink(l)}
                  className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteLink.mutate(l.id)}
                  className="text-xs font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-crimson)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingLink && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
                Edit link
              </p>
              <button onClick={() => setEditingLink(null)}
                className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <input value={editLForm.label}
                onChange={e => setEditLForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Label"
                className="border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }} />
              <input value={editLForm.url}
                onChange={e => setEditLForm(f => ({ ...f, url: e.target.value }))}
                placeholder="URL"
                className="border border-black/10 rounded-xl px-3 py-2.5 text-sm col-span-2"
                style={{ color: 'var(--text-primary)' }} />
              <input value={editLForm.icon_name}
                onChange={e => setEditLForm(f => ({ ...f, icon_name: e.target.value }))}
                placeholder="Icon name"
                className="border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {['guest','member','core','admin'].map(role => (
                <button key={role}
                  onClick={() => setEditLForm(f => ({
                    ...f,
                    access_level: f.access_level.includes(role)
                      ? f.access_level.filter(r => r !== role)
                      : [...f.access_level, role],
                  }))}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: editLForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                    color: editLForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
                  }}>
                  {role}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateLink.mutate({ id: editingLink.id, ...editLForm })}
                disabled={updateLink.isPending || !editLForm.label || !editLForm.url}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {updateLink.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => setEditingLink(null)}
                className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Bento Settings ── */}
      <BentoSettings />

    </div>
  )
}
