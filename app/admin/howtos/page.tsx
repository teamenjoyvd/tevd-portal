'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ── Types ──────────────────────────────────────────────────────────────────

type Block = {
  type: 'heading' | 'paragraph' | 'callout'
  content: { en: string; bg: string }
  emoji?: string
}

type Howto = {
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
}

const ALL_ROLES = ['guest', 'member', 'core', 'admin']

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function emptyHowto(): Omit<Howto, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: '',
    title: { en: '', bg: '' },
    cover_image_url: null,
    emoji: null,
    body: [],
    access_roles: [...ALL_ROLES],
    is_published: false,
  }
}

// ── Block Editor ────────────────────────────────────────────────────────────

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

// ── Form ────────────────────────────────────────────────────────────────────

function HowtoForm({
  initial,
  onSave,
  onCancel,
  isPending,
  error,
}: {
  initial: Omit<Howto, 'id' | 'created_at' | 'updated_at'>
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
      {/* Title EN + BG */}
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

      {/* Slug */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}>Slug</label>
        <input
          value={form.slug}
          onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
          className="w-full border rounded-xl px-3 py-2 text-sm font-mono"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>

      {/* Emoji + Cover image */}
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

      {/* Access Roles */}
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

      {/* Body blocks */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
          style={{ color: 'var(--text-secondary)' }}>Body Blocks</label>
        <BlockEditor blocks={form.body} onChange={body => setForm(f => ({ ...f, body }))} />
      </div>

      {/* Published */}
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
          style={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)',
          }}>
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

// ── Main Page ───────────────────────────────────────────────────────────────

export default function HowtosAdminPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Howto | null>(null)
  const [creating, setCreating] = useState(false)
  const [mutError, setMutError] = useState<string | null>(null)

  const { data: howtos = [], isLoading } = useQuery<Howto[]>({
    queryKey: ['admin-howtos'],
    queryFn: () => fetch('/api/admin/howtos').then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (body: ReturnType<typeof emptyHowto>) =>
      fetch('/api/admin/howtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-howtos'] }); setCreating(false); setMutError(null) },
    onError: (e: Error) => setMutError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Partial<Howto> & { id: string }) =>
      fetch(`/api/admin/howtos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-howtos'] }); setEditing(null); setMutError(null) },
    onError: (e: Error) => setMutError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/admin/howtos/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-howtos'] }),
  })

  const togglePublish = (howto: Howto) =>
    updateMutation.mutate({ id: howto.id, is_published: !howto.is_published })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Howtos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {howtos.length} article{howtos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!creating && !editing && (
          <button
            onClick={() => { setCreating(true); setMutError(null) }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--brand-crimson)' }}>
            + New Howto
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-2xl border p-6"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <h2 className="font-display text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            New Howto
          </h2>
          <HowtoForm
            initial={emptyHowto()}
            onSave={data => createMutation.mutate(data)}
            onCancel={() => { setCreating(false); setMutError(null) }}
            isPending={createMutation.isPending}
            error={mutError}
          />
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="rounded-2xl border p-6"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <h2 className="font-display text-lg font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            Edit: {editing.title.en || editing.slug}
          </h2>
          <HowtoForm
            initial={{ slug: editing.slug, title: editing.title, cover_image_url: editing.cover_image_url, emoji: editing.emoji, body: editing.body, access_roles: editing.access_roles, is_published: editing.is_published }}
            onSave={data => updateMutation.mutate({ id: editing.id, ...data })}
            onCancel={() => { setEditing(null); setMutError(null) }}
            isPending={updateMutation.isPending}
            error={mutError}
          />
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse"
              style={{ backgroundColor: 'var(--border-default)' }} />
          ))}
        </div>
      ) : howtos.length === 0 && !creating ? (
        <div className="rounded-2xl border px-6 py-12 text-center"
          style={{ borderColor: 'var(--border-default)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No howtos yet. Create the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {howtos.map(howto => (
            <div key={howto.id}
              className="rounded-2xl border px-5 py-4 flex items-center gap-4"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <span className="text-xl flex-shrink-0">{howto.emoji ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {howto.title.en || '(untitled)'}
                </p>
                <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                  /{howto.slug} · {howto.access_roles.join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: howto.is_published ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.06)',
                    color: howto.is_published ? '#15803d' : 'var(--text-secondary)',
                  }}>
                  {howto.is_published ? 'Published' : 'Draft'}
                </span>
                <button
                  onClick={() => togglePublish(howto)}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                  style={{
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-secondary)',
                  }}>
                  {howto.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => { setEditing(howto); setMutError(null) }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors hover:bg-black/5"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                  Edit
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${howto.title.en}"?`)) deleteMutation.mutate(howto.id) }}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-red-50 disabled:opacity-50"
                  style={{ color: 'var(--brand-crimson)' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
