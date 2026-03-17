'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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
      setAForm({ titles: { en:'',bg:'',sk:'' }, contents: { en:'',bg:'',sk:'' }, is_active: true })
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

  // ── Quick Links ────────────────────────────────────────────
  const { data: links = [] } = useQuery<QuickLink[]>({
    queryKey: ['quick-links'],
    queryFn: () => fetch('/api/admin/quick-links').then(r => r.json()),
  })

  const [lForm, setLForm] = useState({ label: '', url: '', icon_name: 'link', sort_order: 0 })

  const createLink = useMutation({
    mutationFn: (body: typeof lForm) =>
      fetch('/api/admin/quick-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-links'] })
      setLForm({ label: '', url: '', icon_name: 'link', sort_order: 0 })
    },
  })

  const deleteLink = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/quick-links/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-links'] }),
  })

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
              <button
                onClick={() => deleteLink.mutate(l.id)}
                className="text-xs font-medium hover:opacity-70 transition-opacity flex-shrink-0"
                style={{ color: 'var(--brand-crimson)' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}