'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Drawer } from '@/components/ui/drawer'
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
import { SocialPostForm, InstagramIcon, FacebookIcon } from './SocialPostForm'
import type { SocialPostFormData } from './SocialPostForm'

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
        posted_at: data.posted_at || null,
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
        posted_at: data.posted_at || null,
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
                ? new Date(new Date(socialDrawer.editing.posted_at).getTime() - new Date(socialDrawer.editing.posted_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
