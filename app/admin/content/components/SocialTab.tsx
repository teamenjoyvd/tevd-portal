'use client'

import { useState, useRef } from 'react'
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
import { useLanguage } from '@/lib/hooks/useLanguage'
import { isCdnUrl, isStorageUrl } from '@/lib/social-thumbnail'

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
  posted_at: string | null
}

type SocialPostFormData = {
  platform: 'instagram' | 'facebook'
  post_url: string
  caption: string
  thumbnail_url: string
  posted_at: string
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
  const { t } = useLanguage()
  const [form, setForm] = useState(initial)
  const [previewing, setPreviewing] = useState(false)
  const [previewHint, setPreviewHint] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const thumbnailIsCdn = form.thumbnail_url ? isCdnUrl(form.thumbnail_url) : false
  const thumbnailIsStorage = form.thumbnail_url ? isStorageUrl(form.thumbnail_url) : false
  const thumbnailIsBlocked = thumbnailIsCdn && !thumbnailIsStorage

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
        setPreviewHint(t('admin.content.social.previewUnavailable'))
      }
    } catch {
      setPreviewHint(t('admin.content.social.previewUnavailable'))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/social-posts/upload-thumbnail', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json() as { url: string }
      setForm(f => ({ ...f, thumbnail_url: url }))
    } catch {
      setPreviewHint(t('admin.content.social.previewUnavailable'))
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    const payload: SocialPostFormData = {
      ...form,
      // Strip empty string — datetime-local returns '' when cleared
      posted_at: form.posted_at || '',
    }
    onSave(payload)
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
          placeholder={t('admin.content.social.placeholder.postUrl')}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
        {previewing && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.social.fetchingPreview')}</p>}
        {!previewing && previewHint && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{previewHint}</p>}
      </div>
      <textarea
        value={form.caption}
        onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
        placeholder={t('admin.content.social.placeholder.caption')}
        rows={3}
        className="w-full border rounded-xl px-3 py-2.5 text-sm resize-none"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
      />

      {/* Post date */}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Post date (optional)
        </label>
        <input
          type="datetime-local"
          value={form.posted_at}
          onChange={e => setForm(f => ({ ...f, posted_at: e.target.value }))}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
          Actual published date. Shown on the bento tile. Falls back to creation time if left empty.
        </p>
      </div>

      {/* Thumbnail */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-black/5 disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            {uploading ? t('admin.content.social.btn.uploading') : t('admin.content.social.btn.uploadThumbnail')}
          </button>
          {form.thumbnail_url && thumbnailIsStorage && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              ✓ {t('admin.content.social.thumbnailStored')}
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
              e.target.value = ''
            }}
          />
        </div>
        <input
          value={form.thumbnail_url}
          onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
          placeholder={t('admin.content.social.placeholder.thumbnailUrl')}
          className="w-full border rounded-xl px-3 py-2.5 text-sm"
          style={{
            borderColor: thumbnailIsBlocked ? 'var(--brand-crimson)' : 'var(--border-default)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-card)',
          }}
        />
        {thumbnailIsBlocked && (
          <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>
            {t('admin.content.social.cdnUrlWarning')}
          </p>
        )}
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isPending || !form.post_url || thumbnailIsBlocked}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {isPending ? t('admin.content.social.btn.saving') : t('admin.content.social.btn.save')}
        </button>
        <button onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
          {t('admin.content.social.btn.cancel')}
        </button>
      </div>
    </div>
  )
}

export function SocialTab() {
  const qc = useQueryClient()
  const { t } = useLanguage()
  const socialDrawer = useAdminDrawer<SocialPost>()
  const [socialMutError, setSocialMutError] = useState<string | null>(null)
  const [socialAlertTarget, setSocialAlertTarget] = useState<{ id: string; name: string } | null>(null)
  const [sDragging, setSDragging] = useState<string | null>(null)

  const { data: socialPostsRaw = [] } = useQuery<SocialPost[]>({
    queryKey: ['admin-social-posts'],
    queryFn: () => fetch('/api/admin/social-posts').then(r => r.json()),
  })
  const [localSocials, setLocalSocials] = useState<SocialPost[]>(() => [...socialPostsRaw])
  const [prevSocialsRaw, setPrevSocialsRaw] = useState(socialPostsRaw)
  if (prevSocialsRaw !== socialPostsRaw) {
    setPrevSocialsRaw(socialPostsRaw)
    setLocalSocials([...socialPostsRaw])
  }

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
    mutationFn: (data: SocialPostFormData) => {
      const body = {
        platform: data.platform,
        post_url: data.post_url,
        caption: data.caption || undefined,
        thumbnail_url: data.thumbnail_url || undefined,
        posted_at: data.posted_at || undefined,
      }
      return fetch('/api/admin/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed'); return r.json() })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-social-posts'] })
      qc.invalidateQueries({ queryKey: ['socials'] })
      socialDrawer.close()
      setSocialMutError(null)
    },
    onError: (e: Error) => setSocialMutError(e.message),
  })

  const updateSocialPost = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & SocialPostFormData) => {
      const body = {
        platform: data.platform,
        post_url: data.post_url,
        caption: data.caption || undefined,
        thumbnail_url: data.thumbnail_url || undefined,
        posted_at: data.posted_at || undefined,
      }
      return fetch(`/api/admin/social-posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed'); return r.json() })
    },
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

  const sDrag = makeDragHandlers(sDragging, setSDragging, localSocials, setLocalSocials, items => reorderSocials.mutate(items))

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {socialPostsRaw.length} post{socialPostsRaw.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => { socialDrawer.openCreate(); setSocialMutError(null) }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--brand-crimson)' }}>
          {t('admin.content.social.btn.addPost')}
        </button>
      </div>

      <Drawer
        open={socialDrawer.open}
        onClose={() => { socialDrawer.close(); setSocialMutError(null) }}
        title={socialDrawer.editing
          ? t('admin.content.social.drawer.editTitle').replace('{{name}}', socialDrawer.editing.caption ?? socialDrawer.editing.post_url)
          : t('admin.content.social.drawer.newTitle')
        }
      >
        {socialDrawer.isCreating && (
          <SocialPostForm
            initial={{ platform: 'instagram', post_url: '', caption: '', thumbnail_url: '', posted_at: '' }}
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
              posted_at: socialDrawer.editing.posted_at
                ? new Date(socialDrawer.editing.posted_at).toISOString().slice(0, 16)
                : '',
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
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('admin.content.social.empty')}</p>
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
                {post.is_pinned && <AdminStatusBadge variant="pinned" label={t('admin.content.social.badge.pinned')} />}
                <button onClick={() => patchSocialPost.mutate({ id: post.id, is_visible: !post.is_visible })} disabled={patchSocialPost.isPending}>
                  <AdminStatusBadge
                    variant={post.is_visible ? 'active' : 'inactive'}
                    label={post.is_visible ? t('admin.content.social.badge.active') : t('admin.content.social.badge.hidden')}
                  />
                </button>
                <button onClick={() => patchSocialPost.mutate({ id: post.id, is_pinned: !post.is_pinned })} disabled={patchSocialPost.isPending}
                  className="text-xs px-2.5 py-1 rounded-full font-semibold border transition-all disabled:opacity-50 hover:bg-black/5"
                  style={{ borderColor: 'var(--border-default)', color: post.is_pinned ? 'var(--brand-crimson)' : 'var(--text-secondary)' }}>
                  {post.is_pinned ? t('admin.content.social.btn.unpin') : t('admin.content.social.btn.pin')}
                </button>
                <button onClick={() => { socialDrawer.openEdit(post); setSocialMutError(null) }}
                  className="text-xs font-medium border px-2.5 py-1 rounded-full hover:bg-black/5 transition-colors"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                  {t('admin.content.social.btn.edit')}
                </button>
                <button
                  onClick={() => setSocialAlertTarget({ id: post.id, name: post.caption ?? post.post_url })}
            disabled={deleteSocialPost.isPending}
                  className="text-xs font-medium hover:opacity-70 transition-opacity disabled:opacity-40"
                  style={{ color: 'var(--brand-crimson)' }}>
                  {t('admin.content.social.btn.delete')}
                </button>
              </>
            }
          />
        ))}
      </div>

      <AlertDialog open={!!socialAlertTarget} onOpenChange={open => { if (!open) setSocialAlertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.content.social.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.content.social.dialog.body')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('admin.content.social.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (socialAlertTarget) deleteSocialPost.mutate(socialAlertTarget.id)
                setSocialAlertTarget(null)
              }}
            >
              {t('admin.content.social.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
