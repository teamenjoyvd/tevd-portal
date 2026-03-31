'use client'

import { useEffect, useState } from 'react'
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
  const safeBlocks = Array.isArray(blocks) ? blocks : []

  function addBlock(type: Block['type']) {
    onChange([...safeBlocks, { type, content: { en: '', bg: '' }, emoji: type === 'callout' ? '💡' : undefined }])
  }
  function updateBlock(i: number, partial: Partial<Block>) {
    onChange(safeBlocks.map((b, idx) => idx === i ? { ...b, ...partial } : b))
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

export function GuidesTab() {
  const qc = useQueryClient()
  const guideDrawer = useAdminDrawer<Guide>()
  const [guidesMutError, setGuidesMutError] = useState<string | null>(null)
  const [guideAlertTarget, setGuideAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [gDragging, setGDragging] = useState<string | null>(null)

  const { data: guidesRaw = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ['admin-guides'],
    queryFn: () => fetch('/api/admin/guides').then(r => r.json()),
  })
  const [localGuides, setLocalGuides] = useState<Guide[]>([])
  useEffect(() => { setLocalGuides([...guidesRaw]) }, [guidesRaw])

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
  )
}
