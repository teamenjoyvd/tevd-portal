'use client'

import { Suspense, useEffect } from 'react'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBentoConfig, type BentoConfigEntry } from '@/lib/hooks/useBentoConfig'
import type { Dispatch, SetStateAction } from 'react'
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
import AdminTabs, { TabsContent } from '@/app/admin/components/AdminTabs'
import { AdminListCard } from '@/app/admin/components/AdminListCard'
import { AdminStatusBadge } from '@/app/admin/components/AdminStatusBadge'
import { useAdminDrawer } from '@/app/admin/components/useAdminDrawer'

// ── BentoSettings ───────────────────────────────────────────────

const TILE_LABELS: Record<string, string> = {
  events:        'Events tile',
  trips:         'Trips tile',
  announcements: 'Announcements tile',
  howtos:        'Howtos tile',
  links:         'Links & Guides tile',
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
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
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

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
  sort_order: number
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
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
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
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)

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

  async function handleCoverFileChange(file: File) {
    setCoverFile(file)
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/guides/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed')
      const { url } = await res.json() as { url: string }
      setForm(f => ({ ...f, cover_image_url: url }))
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setCoverUploading(false)
    }
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
            style={{ color: 'var(--text-secondary)' }}>Cover Image</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer hover:bg-black/5 transition-colors flex-shrink-0"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" x2="12" y1="3" y2="15"/>
                </svg>
                {coverUploading ? 'Uploading…' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFileChange(f) }}
                />
              </label>
              {coverFile && !coverUploading && (
                <span className="text-[11px] truncate max-w-[120px]" style={{ color: 'var(--brand-teal)' }}>
                  {coverFile.name}
                </span>
              )}
            </div>
            <input
              value={form.cover_image_url ?? ''}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value || null }))}
              placeholder="or paste URL…"
              className="w-full border rounded-xl px-3 py-2 text-xs"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}
            />
            {form.cover_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.cover_image_url} alt="" className="rounded-lg object-cover" style={{ width: '100%', height: 80 }} />
            )}
          </div>
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
        <AdminStatusBadge variant={form.is_published ? 'active' : 'inactive'} label={form.is_published ? 'Published' : 'Draft'} />
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
          disabled={isPending || !form.slug || !form.title.en || coverUploading}
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

// ── SocialPostForm ──────────────────────────────────────────────

type SocialPostFormData = {
  platform: 'instagram' | 'facebook'
  post_url: string
  caption: string
  thumbnail_url: string
}

function SocialPostForm({
  initial,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial: SocialPostFormData
  onSave: (data: SocialPostFormData) => void
  onCancel: () => void
  isPending: boolean
  error: string | null
}) {
  const [form, setForm] = useState(initial)
  const [previewing, setPreviewing] = useState(false)
  const [previewHint, setPreviewHint] = useState<string | null>(null)

  async function fetchOgPreview(url: string) {
    if (!url) return
    setPreviewing(true)
    setPreviewHint(null)
    try {
      const res = await fetch(`/api/admin/social-posts/preview?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error('preview failed')
      const data = await res.json() as { thumbnail_url: string | null; caption: string | null }
      setForm(f => ({
        ...f,
        thumbnail_url: data.thumbnail_url ?? f.thumbnail_url,
        caption: data.caption ?? f.caption,
      }))
      if (!data.thumbnail_url && !data.caption) {
        setPreviewHint('Preview unavailable for this platform — enter thumbnail URL manually')
      }
    } catch {
      setPreviewHint('Preview unavailable for this platform — enter thumbnail URL manually')
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['instagram', 'facebook'] as const).map(p => (
          <button key={p} onClick={() => setForm(f => ({ ...f, platform: p }))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: form.platform === p ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)', color: form.platform === p ? 'var(--brand-parchment)' : 'var(--text-secondary)' }}>
            {p === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div>
        <input
          value={form.post_url}
          onChange={e => setForm(f => ({ ...f, post_url: e.target.value }))}
          onBlur={e => { if (e.target.value) fetchOgPreview(e.target.value) }}
          placeholder="Post URL (required)"
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
        {previewing && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Fetching preview…</p>}
        {!previewing && previewHint && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{previewHint}</p>}
      </div>
      <textarea
        value={form.caption}
        onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
        placeholder="Caption — auto-extracted from post if left blank"
        rows={3}
        className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
      />
      <input
        value={form.thumbnail_url}
        onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
        placeholder="Thumbnail URL — auto-extracted from post if left blank"
        className="w-full border rounded-xl px-3 py-2.5 text-sm"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
      />
      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.post_url}
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
  { key: 'links',         label: 'Links'         },
  { key: 'guides',        label: 'Guides'        },
  { key: 'socials',       label: 'Social Posts'  },
  { key: 'bento',         label: 'Bento'         },
] as const

type TabKey = typeof TABS[number]['key']

// ── Inner page ────────────────────────────────────────────────────

function ContentPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = (searchParams.get('tab') ?? 'announcements') as TabKey
  const qc = useQueryClient()

  // ── Alert dialog state ────────────────────
  const [announcementAlertTarget, setAnnouncementAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [linkAlertTarget, setLinkAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [guideAlertTarget, setGuideAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [socialAlertTarget, setSocialAlertTarget] = useState<{ id: string; name: string } | null>(null)

  // ── Announcements ───────────────────────────────────
  const { data: announcementsRaw = [] } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => fetch('/api/admin/announcements').then(r => r.json()),
  })
  const [localAnnouncements, setLocalAnnouncements] = useState<Announcement[]>([])
  useEffect(() => { setLocalAnnouncements([...announcementsRaw]) }, [announcementsRaw])
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

  const announcementDrawer = useAdminDrawer<Announcement>()
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
      announcementDrawer.close()
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
    announcementDrawer.openEdit(a)
  }

  // ── Links ────────────────────────────────────────────
  const { data: linksRaw = [] } = useQuery<SiteLink[]>({
    queryKey: ['admin-links'],
    queryFn: () => fetch('/api/admin/links').then(r => r.json()),
  })
  const [localLinks, setLocalLinks] = useState<SiteLink[]>([])
  useEffect(() => { setLocalLinks([...linksRaw]) }, [linksRaw])
  const [lDragging, setLDragging] = useState<string | null>(null)

  const reorderLinks = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      fetch('/api/admin/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(r => r.json()),
    onError: () => setLocalLinks([...linksRaw]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-links'] }),
  })

  const [lForm, setLForm] = useState({
    label: { en: '', bg: '' },
    url: '',
    access_roles: ['guest', 'member', 'core', 'admin'] as string[],
    sort_order: 0,
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

  const linkDrawer = useAdminDrawer<SiteLink>()
  const [editLForm, setEditLForm] = useState({
    label: { en: '', bg: '' },
    url: '',
    access_roles: ['guest', 'member', 'core', 'admin'] as string[],
    sort_order: 0,
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

  // ── Guides ─────────────────────────────────────────
  const guideDrawer = useAdminDrawer<Guide>()
  const [guidesMutError, setGuidesMutError] = useState<string | null>(null)

  const { data: guidesRaw = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['admin-guides'],
    queryFn: () => fetch('/api/admin/guides').then(r => r.json()),
  })
  const [localGuides, setLocalGuides] = useState<Guide[]>([])
  useEffect(() => { setLocalGuides([...guidesRaw]) }, [guidesRaw])
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

  const toggleGuidePublish = (guide: Guide) =>
    updateGuide.mutate({ id: guide.id, is_published: !guide.is_published })

  // ── Social Posts ───────────────────────────────────
  const socialDrawer = useAdminDrawer<SocialPost>()
  const [socialMutError, setSocialMutError] = useState<string | null>(null)

  const { data: socialPostsRaw = [] } = useQuery<SocialPost[]>({
    queryKey: ['admin-social-posts'],
    queryFn: () => fetch('/api/admin/social-posts').then(r => r.json()),
  })
  const [localSocials, setLocalSocials] = useState<SocialPost[]>([])
  useEffect(() => { setLocalSocials([...socialPostsRaw]) }, [socialPostsRaw])
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

  const createSocialPost = useMutation({
    mutationFn: (body: SocialPostFormData) =>
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
      socialDrawer.close()
      setSocialMutError(null)
    },
    onError: (e: Error) => setSocialMutError(e.message),
  })

  const updateSocialPost = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SocialPostFormData) =>
      fetch(`/api/admin/social-posts/${id}`, {
        method: 'PATCH',
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
      socialDrawer.close()
      setSocialMutError(null)
    },
    onError: (e: Error) => setSocialMutError(e.message),
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

      <AdminTabs
        tabs={[...TABS]}
        value={tab}
        onValueChange={(val) => router.replace(`?tab=${val}`, { scroll: false })}
      >
        {/* ── Announcements tab ── */}
        <TabsContent value="announcements">
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

            {/* Inline create card — intentional exception per CLAUDE.md */}
            <div className="rounded-2xl border p-6 mb-4 space-y-3" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <input value={aForm.titles[aLang] ?? ''}
                onChange={e => setAForm(f => ({ ...f, titles: { ...f.titles, [aLang]: e.target.value } }))}
                placeholder={`Title (${aLang.toUpperCase()})`}
                className="w-full border rounded-xl px-3 py-2.5 text-sm"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
              <textarea value={aForm.contents[aLang] ?? ''}
                onChange={e => setAForm(f => ({ ...f, contents: { ...f.contents, [aLang]: e.target.value } }))}
                placeholder={`Content (${aLang.toUpperCase()})`}
                rows={4}
                className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
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
                <AdminListCard
                  key={a.id}
                  grip
                  title={a.titles.en ?? a.titles.bg ?? 'Untitled'}
                  sub={new Date(a.created_at).toLocaleDateString('en-GB').replace(/\//g, '.')}
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
                  className="w-full border rounded-xl px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                <textarea value={editAForm.contents[editALang] ?? ''}
                  onChange={e => setEditAForm(f => ({ ...f, contents: { ...f.contents, [editALang]: e.target.value } }))}
                  placeholder={`Content (${editALang.toUpperCase()})`}
                  rows={4}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
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
        </TabsContent>

        {/* ── Links tab ── */}
        <TabsContent value="links">
          <section>
            {/* Inline create card — intentional exception per CLAUDE.md */}
            <div className="rounded-2xl border p-6 mb-4 space-y-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Label (EN)</label>
                  <input value={lForm.label.en} onChange={e => setLForm(f => ({ ...f, label: { ...f.label, en: e.target.value } }))}
                    placeholder="Label in English"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Label (BG)</label>
                  <input value={lForm.label.bg} onChange={e => setLForm(f => ({ ...f, label: { ...f.label, bg: e.target.value } }))}
                    placeholder="Етикет на български"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>URL</label>
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
                {createLink.isPending ? 'Adding…' : 'Add link'}
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
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                      <button
                        onClick={() => setLinkAlertTarget({ id: l.id, name: l.label.en })}
                        className="text-xs font-medium hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                    </>
                  }
                />
              ))}
              {localLinks.length === 0 && (
                <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No links yet. Add one above.</p>
                </div>
              )}
            </div>

            <Drawer
              open={linkDrawer.open}
              onClose={linkDrawer.close}
              title={linkDrawer.editing ? `Edit: ${linkDrawer.editing.label.en}` : 'Edit link'}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Label (EN)</label>
                    <input value={editLForm.label.en} onChange={e => setEditLForm(f => ({ ...f, label: { ...f.label, en: e.target.value } }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>Label (BG)</label>
                    <input value={editLForm.label.bg} onChange={e => setEditLForm(f => ({ ...f, label: { ...f.label, bg: e.target.value } }))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-secondary)' }}>URL</label>
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
                    {updateLink.isPending ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={linkDrawer.close}
                    className="px-5 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Cancel</button>
                </div>
              </div>
            </Drawer>

            <AlertDialog open={!!linkAlertTarget} onOpenChange={open => { if (!open) setLinkAlertTarget(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete link</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete &ldquo;{linkAlertTarget?.name}&rdquo;? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (linkAlertTarget) deleteLink.mutate(linkAlertTarget.id)
                      setLinkAlertTarget(null)
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </TabsContent>

        {/* ── Guides tab ── */}
        <TabsContent value="guides">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {guidesRaw.length} guide{guidesRaw.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => { guideDrawer.openCreate(); setGuidesMutError(null) }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>+ New Guide</button>
            </div>

            <Drawer
              open={guideDrawer.open}
              onClose={() => { guideDrawer.close(); setGuidesMutError(null) }}
              title={guideDrawer.editing ? `Edit: ${guideDrawer.editing.title.en || guideDrawer.editing.slug}` : 'New Guide'}
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
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No guides yet. Create the first one.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {localGuides.map(guide => (
                  <AdminListCard
                    key={guide.id}
                    grip
                    lead={<span className="text-xl">{guide.emoji ?? '📄'}</span>}
                    title={guide.title.en || '(untitled)'}
                    sub={`/${guide.slug} · ${guide.access_roles.join(', ')}`}
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
                          {guide.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button onClick={() => { guideDrawer.openEdit(guide); setGuidesMutError(null) }}
                          className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
                          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                        <button
                          onClick={() => setGuideAlertTarget({ id: guide.id, name: guide.title.en || guide.slug })}
                          disabled={deleteGuide.isPending}
                          className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-50"
                          style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                      </>
                    }
                  />
                ))}
              </div>
            )}

            <AlertDialog open={!!guideAlertTarget} onOpenChange={open => { if (!open) setGuideAlertTarget(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete guide</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete &ldquo;{guideAlertTarget?.name}&rdquo;? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (guideAlertTarget) deleteGuide.mutate(guideAlertTarget.id)
                      setGuideAlertTarget(null)
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </TabsContent>

        {/* ── Social Posts tab ── */}
        <TabsContent value="socials">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {socialPostsRaw.length} post{socialPostsRaw.length !== 1 ? 's' : ''}
              </p>
              <button onClick={() => { socialDrawer.openCreate(); setSocialMutError(null) }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--brand-crimson)' }}>+ Add post</button>
            </div>

            <Drawer
              open={socialDrawer.open}
              onClose={() => { socialDrawer.close(); setSocialMutError(null) }}
              title={socialDrawer.editing ? `Edit: ${socialDrawer.editing.caption ?? socialDrawer.editing.post_url}` : 'New post'}
            >
              {socialDrawer.isCreating && (
                <SocialPostForm
                  initial={{ platform: 'instagram', post_url: '', caption: '', thumbnail_url: '' }}
                  onSave={data => createSocialPost.mutate(data)}
                  onCancel={() => { socialDrawer.close(); setSocialMutError(null) }}
                  isPending={createSocialPost.isPending}
                  error={socialMutError}
                />
              )}
              {socialDrawer.isEditing && socialDrawer.editing && (
                <SocialPostForm
                  initial={{
                    platform: socialDrawer.editing.platform,
                    post_url: socialDrawer.editing.post_url,
                    caption: socialDrawer.editing.caption ?? '',
                    thumbnail_url: socialDrawer.editing.thumbnail_url ?? '',
                  }}
                  onSave={data => updateSocialPost.mutate({ id: socialDrawer.editing!.id, ...data })}
                  onCancel={() => { socialDrawer.close(); setSocialMutError(null) }}
                  isPending={updateSocialPost.isPending}
                  error={socialMutError}
                />
              )}
            </Drawer>

            <div className="space-y-1.5">
              {localSocials.length === 0 && (
                <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No posts yet.</p>
                </div>
              )}
              {localSocials.map(post => (
                <AdminListCard
                  key={post.id}
                  grip
                  lead={
                    <div className="rounded-lg overflow-hidden flex-shrink-0" style={{ width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.06)' }}>
                      {post.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
                          {post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
                        </div>
                      )}
                    </div>
                  }
                  title={post.caption ?? post.post_url}
                  sub={post.platform}
                  dragging={sDrag.isDragging(post.id)}
                  onDragStart={() => sDrag.onDragStart(post.id)}
                  onDragOver={e => sDrag.onDragOver(e, post.id)}
                  onDrop={sDrag.onDrop}
                  onDragEnd={sDrag.onDragEnd}
                  actions={
                    <>
                      {post.is_pinned && <AdminStatusBadge variant="pinned" label="Pinned" />}
                      <button onClick={() => patchSocialPost.mutate({ id: post.id, is_visible: !post.is_visible })} disabled={patchSocialPost.isPending}>
                        <AdminStatusBadge variant={post.is_visible ? 'active' : 'inactive'} label={post.is_visible ? 'Active' : 'Hidden'} />
                      </button>
                      <button onClick={() => patchSocialPost.mutate({ id: post.id, is_pinned: !post.is_pinned })} disabled={patchSocialPost.isPending}
                        className="text-xs px-2.5 py-1 rounded-full font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                        style={{ borderColor: 'var(--border-default)', color: post.is_pinned ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                        {post.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button onClick={() => { socialDrawer.openEdit(post); setSocialMutError(null) }}
                        className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Edit</button>
                      <button
                        onClick={() => setSocialAlertTarget({ id: post.id, name: post.caption ?? post.post_url })}
                        disabled={deleteSocialPost.isPending}
                        className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                        style={{ color: 'var(--brand-crimson)' }}>Delete</button>
                    </>
                  }
                />
              ))}
            </div>

            <AlertDialog open={!!socialAlertTarget} onOpenChange={open => { if (!open) setSocialAlertTarget(null) }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete post</AlertDialogTitle>
                  <AlertDialogDescription>
                    Delete this post? This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (socialAlertTarget) deleteSocialPost.mutate(socialAlertTarget.id)
                      setSocialAlertTarget(null)
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </TabsContent>

        {/* ── Bento tab ── */}
        <TabsContent value="bento">
          <BentoSettings />
        </TabsContent>
      </AdminTabs>
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
