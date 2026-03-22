'use client'

import { Suspense, useRef } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBentoConfig, type BentoConfigEntry } from '@/lib/hooks/useBentoConfig'
import type { Dispatch, SetStateAction } from 'react'

// ── Shared drag handle ───────────────────────────────────────────────

function GripHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0"
      style={{ color: 'var(--text-secondary)', cursor: 'grab' }}>
      <circle cx="4" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="4" cy="11" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="3" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="7" r="1.2" fill="currentColor"/>
      <circle cx="10" cy="11" r="1.2" fill="currentColor"/>
    </svg>
  )
}

// ── BentoSettings ───────────────────────────────────────────────

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

// ── Types ───────────────────────────────────────────────────────

type Announcement = {
  id: string; titles: Record<string,string>; contents: Record<string,string>
  access_level: string[]; is_active: boolean; created_at: string; sort_order: number
}
type QuickLink = {
  id: string; label: string; url: string; icon_name: string
  access_level: string[]; sort_order: number
}
type SocialPost = {
  id: string
  platform: 'instagram' | 'facebook'
  post_url: string
  caption: string | null
  thumbnail_url: string | null
  is_visible: boolean
  is_pinned: boolean
  sort_order: number
  created_at: string
}

function InstagramIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const LANGS = ['en', 'bg', 'sk']

// ── Guides types ───────────────────────────────────────────────

type Block = {
  type: 'heading' | 'paragraph' | 'callout'
  content: { en: string; bg: string }
  emoji?: string
}

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  cover_image_url: string | null
  emoji: string | null
  body: Block[]
  access_roles: string[]
  is_published: boolean
  created_at: string
  updated_at: string
  sort_order: number
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function emptyGuide(): Omit<Guide, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: '',
    title: { en: '', bg: '' },
    cover_image_url: null,
    emoji: null,
    body: [],
    access_roles: [...ALL_ROLES],
    is_published: false,
    sort_order: 0,
  }
}

function BlockEditor({ blocks, onChange }: { blocks: Block[]; onChange: (b: Block[]) => void }) {
  function addBlock(type: Block['type']) {
    onChange([...safeBlocks, { type, content: { en: '', bg: '' }, emoji: type === 'callout' ? '💡' : undefined }])
  }
  function updateBlock(i: number, partial: Partial<Block>) {
    const next = safeBlocks.map((b, idx) => idx === i ? { ...b, ...partial } : b)
    onChange(next)
  }
  function updateContent(i: number, lang: 'en' | 'bg', value: string) {
    updateBlock(i, { content: { ...safeBlocks[i].content, [lang]: value } })
  }
  function moveBlock(i: number, dir: -1 | 1) {
    const next = [...safeBlocks]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  function removeBlock(i: number) {
    onChange(safeBlocks.filter((_, idx) => idx !== i))
  }

  const safeBlocks = Array.isArray(blocks) ? blocks : []

  return (
    <div className="space-y-3">
      {safeBlocks.map((block, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3"
          style={{ backgroundColor: 'var(--bg-global)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest"
                style={{
                  backgroundColor: block.type === 'heading' ? 'var(--brand-forest)' : block.type === 'callout' ? 'var(--brand-teal)' : 'rgba(0,0,0,0.06)',
                  color: block.type === 'paragraph' ? 'var(--text-secondary)' : 'var(--brand-parchment)',
                }}>
                {block.type}
              </span>
              {block.type === 'callout' && (
                <input
                  value={block.emoji ?? ''}
                  onChange={e => updateBlock(i, { emoji: e.target.value })}
                  placeholder="emoji"
                  className="w-14 border rounded-lg px-2 py-1 text-sm text-center"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => moveBlock(i, -1)} disabled={i === 0}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 disabled:opacity-30 text-xs"
                style={{ color: 'var(--text-secondary)' }}>↑</button>
              <button onClick={() => moveBlock(i, 1)} disabled={i === safeBlocks.length - 1}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 disabled:opacity-30 text-xs"
                style={{ color: 'var(--text-secondary)' }}>↓</button>
              <button onClick={() => removeBlock(i)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 text-xs"
                style={{ color: 'var(--brand-crimson)' }}>✕</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['en', 'bg'] as const).map(lang => (
              <div key={lang}>
                <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block"
                  style={{ color: 'var(--text-secondary)' }}>{lang.toUpperCase()}</label>
                {block.type === 'paragraph' || block.type === 'callout' ? (
                  <textarea
                    value={block.content[lang]}
                    onChange={e => updateContent(i, lang, e.target.value)}
                    rows={3}
                    className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                  />
                ) : (
                  <input
                    value={block.content[lang]}
                    onChange={e => updateContent(i, lang, e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        {(['heading', 'paragraph', 'callout'] as const).map(type => (
          <button key={type} onClick={() => addBlock(type)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            + {type}
          </button>
        ))}
      </div>
    </div>
  )
}

function GuideForm({
  initial,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial: Omit<Guide, 'id' | 'created_at' | 'updated_at'>
  onSave: (data: typeof initial) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}) {
  const [form, setForm] = useState({
    ...initial,
    body: Array.isArray(initial.body) ? initial.body : [],
    access_roles: Array.isArray(initial.access_roles) ? initial.access_roles : [...ALL_ROLES],
  })
  const [slugManual, setSlugManual] = useState(!!initial.slug)
  const [copied, setCopied] = useState(false)

  function copySlugUrl() {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/guides/${form.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleTitleEnChange(val: string) {
    setForm(f => ({
      ...f,
      title: { ...f.title, en: val },
      slug: slugManual ? f.slug : slugify(val),
    }))
  }

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      access_roles: f.access_roles.includes(role)
        ? f.access_roles.filter(r => r !== role)
        : [...f.access_roles, role],
    }))
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {(['en', 'bg'] as const).map(lang => (
          <div key={lang}>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
              style={{ color: 'var(--text-secondary)' }}>Title ({lang.toUpperCase()})</label>
            <input
              value={form.title[lang]}
              onChange={e => lang === 'en' ? handleTitleEnChange(e.target.value) : setForm(f => ({ ...f, title: { ...f.title, bg: e.target.value } }))}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}>Slug</label>
        <div className="flex items-center gap-2">
          <input
            value={form.slug}
            onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
            className="flex-1 border rounded-xl px-3 py-2 text-sm font-mono"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
          <button
            type="button"
            onClick={copySlugUrl}
            disabled={!form.slug}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-30 hover:bg-black/5 flex-shrink-0"
            style={{
              borderColor: copied ? 'rgba(34,197,94,0.4)' : 'var(--border-default)',
              color: copied ? '#15803d' : 'var(--text-secondary)',
              backgroundColor: copied ? 'rgba(34,197,94,0.08)' : 'transparent',
            }}
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy URL
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
            style={{ color: 'var(--text-secondary)' }}>Emoji</label>
          <input
            value={form.emoji ?? ''}
            onChange={e => setForm(f => ({ ...f, emoji: e.target.value || null }))}
            placeholder="e.g. 📦"
            className="w-full border rounded-xl px-3 py-2 text-sm text-center"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
            style={{ color: 'var(--text-secondary)' }}>Cover Image URL</label>
          <input
            value={form.cover_image_url ?? ''}
            onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value || null }))}
            placeholder="https://..."
            className="w-full border rounded-xl px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
          style={{ color: 'var(--text-secondary)' }}>Access Roles</label>
        <div className="flex gap-2">
          {ALL_ROLES.map(role => (
            <button key={role} onClick={() => toggleRole(role)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: form.access_roles.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
                color: form.access_roles.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
              }}>
              {role}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
          style={{ color: 'var(--text-secondary)' }}>Body Blocks</label>
        <BlockEditor blocks={form.body} onChange={body => setForm(f => ({ ...f, body }))} />
      </div>

      <div className="flex items-center gap-3">
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: form.is_published ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.06)',
            color: form.is_published ? '#15803d' : 'var(--text-secondary)',
          }}>
          {form.is_published ? 'Published' : 'Draft'}
        </span>
        <button
          onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {form.is_published ? 'Unpublish' : 'Publish'}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.slug || !form.title.en}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────

const TABS = [
  { key: 'announcements', label: 'Announcements' },
  { key: 'links',         label: 'Quick Links'   },
  { key: 'guides',        label: 'Guides'        },
  { key: 'socials',       label: 'Social Posts'  },
  { key: 'bento',         label: 'Bento'         },
] as const

type TabKey = typeof TABS[number]['key']

// ── Inner page ────────────────────────────────────────────────────

function ContentPageInner() {
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'announcements') as TabKey
  const qc = useQueryClient()

  // ── Announcements ───────────────────────────────────
  const { data: announcementsRaw = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })
  const [localAnnouncements, setLocalAnnouncements] = useState<Announcement[]>([])
  const aPrevKey = useRef('')
  const aKey = announcementsRaw.map(a => a.id).join(',')
  if (aPrevKey.current !== aKey) { aPrevKey.current = aKey; setLocalAnnouncements([...announcementsRaw]) }
  const [aDragging, setADragging] = useState<string | null>(null)

  const reorderAnnouncements = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalAnnouncements([...announcementsRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
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

  // ── Quick Links ────────────────────────────────────
  const { data: linksRaw = [] } = useQuery<QuickLink[]>({
    queryKey: ['quick-links'],
    queryFn: () => fetch('/api/admin/quick-links').then(r => r.json()),
  })
  const [localLinks, setLocalLinks] = useState<QuickLink[]>([])
  const lPrevKey = useRef('')
  const lKey = linksRaw.map(l => l.id).join(',')
  if (lPrevKey.current !== lKey) { lPrevKey.current = lKey; setLocalLinks([...linksRaw]) }
  const [lDragging, setLDragging] = useState<string | null>(null)

  const reorderLinks = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/quick-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalLinks([...linksRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-links'] }),
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

  // ── Guides ─────────────────────────────────────────
  const [guidesEditing, setGuidesEditing] = useState<Guide | null>(null)
  const [guidesCreating, setGuidesCreating] = useState(false)
  const [guidesMutError, setGuidesMutError] = useState<string | null>(null)

  const { data: guidesRaw = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['admin-guides'],
    queryFn: () => fetch('/api/admin/guides').then(r => r.json()),
  })
  const [localGuides, setLocalGuides] = useState<Guide[]>([])
  const gPrevKey = useRef('')
  const gKey = guidesRaw.map(g => g.id).join(',')
  if (gPrevKey.current !== gKey) { gPrevKey.current = gKey; setLocalGuides([...guidesRaw]) }
  const [gDragging, setGDragging] = useState<string | null>(null)

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-guides'] }); setGuidesCreating(false); setGuidesMutError(null) },
    onError: (e: Error) => setGuidesMutError(e.message),
  })

  const updateGuide = useMutation({
    mutationFn: ({ id, ...body }: Partial<Guide> & { id: string }) =>
      fetch(`/api/admin/guides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-guides'] }); setGuidesEditing(null); setGuidesMutError(null) },
    onError: (e: Error) => setGuidesMutError(e.message),
  })

  const deleteGuide = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/guides/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-guides'] }),
  })

  const toggleGuidePublish = (guide: Guide) =>
    updateGuide.mutate({ id: guide.id, is_published: !guide.is_published })

  // ── Social Posts ───────────────────────────────────
  const { data: socialPostsRaw = [] } = useQuery<SocialPost[]>({
    queryKey: ['admin-social-posts'],
    queryFn: () => fetch('/api/admin/social-posts').then(r => r.json()),
  })
  const [localSocials, setLocalSocials] = useState<SocialPost[]>([])
  const sPrevKey = useRef('')
  const sKey = socialPostsRaw.map(p => p.id).join(',')
  if (sPrevKey.current !== sKey) { sPrevKey.current = sKey; setLocalSocials([...socialPostsRaw]) }
  const [sDragging, setSDragging] = useState<string | null>(null)

  const reorderSocials = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/social-posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalSocials([...socialPostsRaw]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-social-posts'] }); qc.invalidateQueries({ queryKey: ['socials'] }) },
  })

  const [spForm, setSpForm] = useState({
    platform: 'instagram' as 'instagram' | 'facebook',
    post_url: '',
    caption: '',
    thumbnail_url: '',
  })
  // null = not yet attempted, true = scraping, false = scrape done (success or fail)
  const [spPreviewing, setSpPreviewing] = useState(false)
  const [spPreviewHint, setSpPreviewHint] = useState<string | null>(null)

  async function fetchOgPreview(url: string) {
    if (!url) return
    setSpPreviewing(true)
    setSpPreviewHint(null)
    try {
      const res = await fetch(`/api/admin/social-posts/preview?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error('preview failed')
      const data = await res.json() as { thumbnail_url: string | null; caption: string | null }
      setSpForm(f => ({
        ...f,
        thumbnail_url: data.thumbnail_url ?? f.thumbnail_url,
        caption: data.caption ?? f.caption,
      }))
      if (!data.thumbnail_url && !data.caption) {
        setSpPreviewHint('Preview unavailable for this platform — enter thumbnail URL manually')
      }
    } catch {
      setSpPreviewHint('Preview unavailable for this platform — enter thumbnail URL manually')
    } finally {
      setSpPreviewing(false)
    }
  }

  const createSocialPost = useMutation({
    mutationFn: (body: typeof spForm) =>
      fetch('/api/admin/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          caption: body.caption || undefined,
          thumbnail_url: body.thumbnail_url || undefined,
        }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed'); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social-posts'] })
      qc.invalidateQueries({ queryKey: ['socials'] })
      setSpForm({ platform: 'instagram', post_url: '', caption: '', thumbnail_url: '' })
      setSpPreviewHint(null)
    },
  })

  const patchSocialPost = useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<SocialPost>) =>
      fetch(`/api/admin/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social-posts'] })
      qc.invalidateQueries({ queryKey: ['socials'] })
    },
  })

  const deleteSocialPost = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/social-posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social-posts'] })
      qc.invalidateQueries({ queryKey: ['socials'] })
    },
  })

  // ── Generic drag helpers ───────────────────────────────
  // setLocal uses React.Dispatch<SetStateAction<T[]>> so the callback form is accepted by tsc
  function makeDragHandlers<T extends { id: string }>(
    dragging: string | null,
    setDragging: (id: string | null) => void,
    local: T[],
    setLocal: Dispatch<SetStateAction<T[]>>,
    onDrop: (items: { id: string; sort_order: number }[]) => void,
  ) {
    return {
      onDragStart: (id: string) => setDragging(id),
      onDragOver: (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        if (!dragging || dragging === targetId) return
        setLocal(prev => {
          const from = prev.findIndex(x => x.id === dragging)
          const to   = prev.findIndex(x => x.id === targetId)
          if (from === -1 || to === -1) return prev
          const next = [...prev]
          const [moved] = next.splice(from, 1)
          next.splice(to, 0, moved)
          return next
        })
      },
      onDrop: () => {
        setDragging(null)
        onDrop(local.map((item, i) => ({ id: item.id, sort_order: i * 10 })))
      },
      onDragEnd: () => setDragging(null),
      isDragging: (id: string) => dragging === id,
    }
  }

  const aDrag = makeDragHandlers(aDragging, setADragging, localAnnouncements, setLocalAnnouncements, items => reorderAnnouncements.mutate(items))
  const lDrag = makeDragHandlers(lDragging, setLDragging, localLinks, setLocalLinks, items => reorderLinks.mutate(items))
  const gDrag = makeDragHandlers(gDragging, setGDragging, localGuides, setLocalGuides, items => reorderGuides.mutate(items))
  const sDrag = makeDragHandlers(sDragging, setSDragging, localSocials, setLocalSocials, items => reorderSocials.mutate(items))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Content
        </h1>
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border-default)' }}>
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/admin/content?tab=${t.key}`}
              scroll={false}
              className="px-4 py-2.5 text-sm font-semibold transition-colors relative"
              style={{
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: tab === t.key ? '2px solid var(--brand-crimson)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {/* ── Announcements tab ── */}
        {tab === 'announcements' && (
          <section>
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
              <input value={aForm.titles[aLang] ?? ''}
                onChange={e => setAForm(f => ({ ...f, titles: { ...f.titles, [aLang]: e.target.value } }))}
                placeholder={`Title (${aLang.toUpperCase()})`}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                style={{ color: 'var(--text-primary)' }} />
              <textarea value={aForm.contents[aLang] ?? ''}
                onChange={e => setAForm(f => ({ ...f, contents: { ...f.contents, [aLang]: e.target.value } }))}
                placeholder={`Content (${aLang.toUpperCase()})`}
                rows={4}
                className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ color: 'var(--text-primary)' }} />
              <div className="flex gap-2 flex-wrap">
                {['guest','member','core','admin'].map(role => (
                  <button key={role}
                    onClick={() => setAForm(f => ({ ...f, access_level: f.access_level.includes(role) ? f.access_level.filter(r => r !== role) : [...f.access_level, role] }))}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: aForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: aForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                    {role}
                  </button>
                ))}
              </div>
              <button onClick={() => createAnnouncement.mutate(aForm)}
                disabled={createAnnouncement.isPending || !aForm.titles.en}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {createAnnouncement.isPending ? 'Publishing…' : 'Publish'}
              </button>
            </div>

            <div className="space-y-1.5">
              {localAnnouncements.map(a => (
                <div key={a.id}
                  draggable
                  onDragStart={() => aDrag.onDragStart(a.id)}
                  onDragOver={e => aDrag.onDragOver(e, a.id)}
                  onDrop={aDrag.onDrop}
                  onDragEnd={aDrag.onDragEnd}
                  className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-start gap-3"
                  style={{ opacity: aDrag.isDragging(a.id) ? 0.5 : 1 }}>
                  <GripHandle />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {a.titles.en ?? a.titles.bg ?? 'Untitled'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startEditingAnnouncement(a)}
                      className="text-xs px-2.5 py-1 rounded-full font-medium border hover:bg-black/5 transition-colors"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                    <button onClick={() => toggleAnnouncement.mutate({ id: a.id, is_active: !a.is_active })}
                      className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: a.is_active ? '#81b29a33' : 'rgba(0,0,0,0.05)', color: a.is_active ? '#2d6a4f' : 'var(--text-secondary)' }}>
                      {a.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button onClick={() => deleteAnnouncement.mutate(a.id)}
                      className="text-xs font-medium hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            {editingAnnouncement && (
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Edit announcement</p>
                  <button onClick={() => setEditingAnnouncement(null)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
                <div className="flex gap-2 mb-2">
                  {LANGS.map(l => (
                    <button key={l} onClick={() => setEditALang(l)}
                      className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                      style={{ backgroundColor: editALang === l ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)', color: editALang === l ? 'white' : 'var(--text-secondary)' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <input value={editAForm.titles[editALang] ?? ''}
                  onChange={e => setEditAForm(f => ({ ...f, titles: { ...f.titles, [editALang]: e.target.value } }))}
                  placeholder={`Title (${editALang.toUpperCase()})`}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm"
                  style={{ color: 'var(--text-primary)' }} />
                <textarea value={editAForm.contents[editALang] ?? ''}
                  onChange={e => setEditAForm(f => ({ ...f, contents: { ...f.contents, [editALang]: e.target.value } }))}
                  placeholder={`Content (${editALang.toUpperCase()})`}
                  rows={4}
                  className="w-full border border-black/10 rounded-xl px-3 py-2.5 text-sm resize-none"
                  style={{ color: 'var(--text-primary)' }} />
                <div className="flex gap-2 flex-wrap">
                  {['guest','member','core','admin'].map(role => (
                    <button key={role}
                      onClick={() => setEditAForm(f => ({ ...f, access_level: f.access_level.includes(role) ? f.access_level.filter(r => r !== role) : [...f.access_level, role] }))}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{ backgroundColor: editAForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: editAForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                      {role}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => updateAnnouncement.mutate({ id: editingAnnouncement.id, ...editAForm })}
                    disabled={updateAnnouncement.isPending || !editAForm.titles.en}
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-crimson)' }}>
                    {updateAnnouncement.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={() => setEditingAnnouncement(null)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Quick Links tab ── */}
        {tab === 'links' && (
          <section>
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mb-4">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <input value={lForm.label} onChange={e => setLForm(f => ({ ...f, label: e.target.value }))} placeholder="Label" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
                <input value={lForm.url} onChange={e => setLForm(f => ({ ...f, url: e.target.value }))} placeholder="URL" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm col-span-2" style={{ color: 'var(--text-primary)' }} />
                <input value={lForm.icon_name} onChange={e => setLForm(f => ({ ...f, icon_name: e.target.value }))} placeholder="Icon name" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
              </div>
              <div className="flex gap-2 flex-wrap mb-4">
                {['guest','member','core','admin'].map(role => (
                  <button key={role}
                    onClick={() => setLForm(f => ({ ...f, access_level: f.access_level.includes(role) ? f.access_level.filter(r => r !== role) : [...f.access_level, role] }))}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: lForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: lForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                    {role}
                  </button>
                ))}
              </div>
              <button onClick={() => createLink.mutate(lForm)}
                disabled={createLink.isPending || !lForm.label || !lForm.url}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {createLink.isPending ? 'Adding…' : 'Add link'}
              </button>
            </div>

            <div className="space-y-1.5">
              {localLinks.map(l => (
                <div key={l.id}
                  draggable
                  onDragStart={() => lDrag.onDragStart(l.id)}
                  onDragOver={e => lDrag.onDragOver(e, l.id)}
                  onDrop={lDrag.onDrop}
                  onDragEnd={lDrag.onDragEnd}
                  className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex items-center gap-3"
                  style={{ opacity: lDrag.isDragging(l.id) ? 0.5 : 1 }}>
                  <GripHandle />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{l.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{l.url}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => startEditingLink(l)}
                      className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                    <button onClick={() => deleteLink.mutate(l.id)}
                      className="text-xs font-medium hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>

            {editingLink && (
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>Edit link</p>
                  <button onClick={() => setEditingLink(null)} className="text-xs hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <input value={editLForm.label} onChange={e => setEditLForm(f => ({ ...f, label: e.target.value }))} placeholder="Label" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
                  <input value={editLForm.url} onChange={e => setEditLForm(f => ({ ...f, url: e.target.value }))} placeholder="URL" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm col-span-2" style={{ color: 'var(--text-primary)' }} />
                  <input value={editLForm.icon_name} onChange={e => setEditLForm(f => ({ ...f, icon_name: e.target.value }))} placeholder="Icon name" className="border border-black/10 rounded-xl px-3 py-2.5 text-sm" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {['guest','member','core','admin'].map(role => (
                    <button key={role}
                      onClick={() => setEditLForm(f => ({ ...f, access_level: f.access_level.includes(role) ? f.access_level.filter(r => r !== role) : [...f.access_level, role] }))}
                      className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                      style={{ backgroundColor: editLForm.access_level.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: editLForm.access_level.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                      {role}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => updateLink.mutate({ id: editingLink.id, ...editLForm })}
                    disabled={updateLink.isPending || !editLForm.label || !editLForm.url}
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: 'var(--brand-crimson)' }}>
                    {updateLink.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={() => setEditingLink(null)}
                    className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Guides tab ── */}
        {tab === 'guides' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {guidesRaw.length} guide{guidesRaw.length !== 1 ? 's' : ''}
              </p>
              {!guidesCreating && !guidesEditing && (
                <button onClick={() => { setGuidesCreating(true); setGuidesMutError(null) }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--brand-crimson)' }}>+ New Guide</button>
              )}
            </div>

            {guidesCreating && (
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <h2 className="font-display text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>New Guide</h2>
                <GuideForm initial={emptyGuide()} onSave={data => createGuide.mutate(data)} onCancel={() => { setGuidesCreating(false); setGuidesMutError(null) }} isPending={createGuide.isPending} error={guidesMutError} />
              </div>
            )}

            {guidesEditing && (
              <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <h2 className="font-display text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>Edit: {guidesEditing.title.en || guidesEditing.slug}</h2>
                <GuideForm
                  initial={{ slug: guidesEditing.slug, title: guidesEditing.title, cover_image_url: guidesEditing.cover_image_url, emoji: guidesEditing.emoji, body: guidesEditing.body, access_roles: guidesEditing.access_roles, is_published: guidesEditing.is_published, sort_order: guidesEditing.sort_order }}
                  onSave={data => updateGuide.mutate({ id: guidesEditing.id, ...data })}
                  onCancel={() => { setGuidesEditing(null); setGuidesMutError(null) }}
                  isPending={updateGuide.isPending}
                  error={guidesMutError}
                />
              </div>
            )}

            {guidesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--border-default)' }} />
                ))}
              </div>
            ) : guidesRaw.length === 0 && !guidesCreating ? (
              <div className="rounded-2xl border px-6 py-12 text-center" style={{ borderColor: 'var(--border-default)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No guides yet. Create the first one.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {localGuides.map(guide => (
                  <div key={guide.id}
                    draggable
                    onDragStart={() => gDrag.onDragStart(guide.id)}
                    onDragOver={e => gDrag.onDragOver(e, guide.id)}
                    onDrop={gDrag.onDrop}
                    onDragEnd={gDrag.onDragEnd}
                    className="rounded-2xl border px-4 py-4 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', opacity: gDrag.isDragging(guide.id) ? 0.5 : 1 }}>
                    <GripHandle />
                    <span className="text-xl flex-shrink-0">{guide.emoji ?? '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{guide.title.en || '(untitled)'}</p>
                      <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>/{guide.slug} · {guide.access_roles.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: guide.is_published ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.06)', color: guide.is_published ? '#15803d' : 'var(--text-secondary)' }}>
                        {guide.is_published ? 'Published' : 'Draft'}
                      </span>
                      <button onClick={() => toggleGuidePublish(guide)} disabled={updateGuide.isPending}
                        className="px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                        {guide.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button onClick={() => { setGuidesEditing(guide); setGuidesMutError(null) }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                      <button onClick={() => { if (confirm(`Delete "${guide.title.en}"?`)) deleteGuide.mutate(guide.id) }}
                        disabled={deleteGuide.isPending}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-red-50 disabled:opacity-50"
                        style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Social Posts tab ── */}
        {tab === 'socials' && (
          <section className="space-y-6">
            <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-crimson)' }}>Add post</p>
              <div className="flex gap-2">
                {(['instagram', 'facebook'] as const).map(p => (
                  <button key={p} onClick={() => setSpForm(f => ({ ...f, platform: p }))}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ backgroundColor: spForm.platform === p ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: spForm.platform === p ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
                    {p === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div>
                <input
                  value={spForm.post_url}
                  onChange={e => setSpForm(f => ({ ...f, post_url: e.target.value }))}
                  onBlur={e => { if (e.target.value) fetchOgPreview(e.target.value) }}
                  placeholder="Post URL (required)"
                  className="w-full border rounded-xl px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
                />
                {spPreviewing && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Fetching preview…</p>
                )}
                {!spPreviewing && spPreviewHint && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{spPreviewHint}</p>
                )}
              </div>
              <textarea
                value={spForm.caption}
                onChange={e => setSpForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="Caption — auto-extracted from post if left blank"
                rows={3}
                className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
              />
              <input
                value={spForm.thumbnail_url}
                onChange={e => setSpForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                placeholder="Thumbnail URL — auto-extracted from post if left blank"
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-global)' }}
              />
              {createSocialPost.isError && (
                <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{(createSocialPost.error as Error).message}</p>
              )}
              <button onClick={() => createSocialPost.mutate(spForm)} disabled={createSocialPost.isPending || !spForm.post_url}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>
                {createSocialPost.isPending ? 'Adding…' : 'Add post'}
              </button>
            </div>

            <div className="space-y-1.5">
              {localSocials.length === 0 && (
                <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No posts yet. Add one above.</p>
                </div>
              )}
              {localSocials.map(post => (
                <div key={post.id}
                  draggable
                  onDragStart={() => sDrag.onDragStart(post.id)}
                  onDragOver={e => sDrag.onDragOver(e, post.id)}
                  onDrop={sDrag.onDrop}
                  onDragEnd={sDrag.onDragEnd}
                  className="rounded-2xl border px-4 py-3 flex items-center gap-3"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', opacity: sDrag.isDragging(post.id) ? 0.5 : 1 }}>
                  <GripHandle />
                  <div className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.06)' }}>
                    {post.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                        {post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>{post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}</span>
                      {post.is_pinned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--brand-crimson)' }}>Pinned</span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{post.caption ?? post.post_url}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => patchSocialPost.mutate({ id: post.id, is_visible: !post.is_visible })} disabled={patchSocialPost.isPending}
                      className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all disabled:opacity-50"
                      style={{ backgroundColor: post.is_visible ? 'rgba(26,107,74,0.12)' : 'rgba(0,0,0,0.06)', color: post.is_visible ? '#1a6b4a' : 'var(--text-secondary)' }}>
                      {post.is_visible ? 'Active' : 'Hidden'}
                    </button>
                    <button onClick={() => patchSocialPost.mutate({ id: post.id, is_pinned: !post.is_pinned })} disabled={patchSocialPost.isPending}
                      className="text-xs px-2.5 py-1 rounded-full font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                      style={{ borderColor: 'var(--border-default)', color: post.is_pinned ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                      {post.is_pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button onClick={() => { if (window.confirm('Delete this post?')) deleteSocialPost.mutate(post.id) }} disabled={deleteSocialPost.isPending}
                      className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                      style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Bento tab ── */}
        {tab === 'bento' && <BentoSettings />}
      </div>
    </div>
  )
}

export default function ContentPage() {
  return (
    <Suspense>
      <ContentPageInner />
    </Suspense>
  )
}
