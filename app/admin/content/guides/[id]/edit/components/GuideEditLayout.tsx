'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AdminStatusBadge } from '@/app/admin/components/AdminStatusBadge'
import { RoleSelector } from '@/app/admin/components/RoleSelector'
import { CoverImageUploader } from '@/app/admin/content/components/CoverImageUploader'
import { BlockEditor } from '@/app/admin/content/components/BlockEditor'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { ALL_ROLES, slugify, type Guide } from '@/app/admin/content/components/guide-types'

type FormState = Omit<Guide, 'id' | 'created_at' | 'updated_at'>

function LeftPanel({
  form,
  setForm,
  isPending,
  coverUploading,
  setCoverUploading,
  error,
  onSave,
  onCancel,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  isPending: boolean
  coverUploading: boolean
  setCoverUploading: (v: boolean) => void
  error: string | null
  onSave: () => void
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [slugManual, setSlugManual] = useState(!!form.slug)
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

  return (
    <div className="space-y-5">
      {/* Titles */}
      <div className="grid grid-cols-2 gap-3">
        {(['en', 'bg'] as const).map(lang => (
          <div key={lang}>
            <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
              style={{ color: 'var(--text-secondary)' }}>
              {lang === 'en' ? t('admin.content.guides.lbl.titleEn') : t('admin.content.guides.lbl.titleBg')}
            </label>
            <input
              value={form.title[lang]}
              onChange={e =>
                lang === 'en'
                  ? handleTitleEnChange(e.target.value)
                  : setForm(f => ({ ...f, title: { ...f.title, bg: e.target.value } }))
              }
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
        ))}
      </div>

      {/* Slug */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}>{t('admin.content.guides.lbl.slug')}</label>
        <div className="flex items-center gap-2">
          <input
            value={form.slug}
            onChange={e => { setSlugManual(true); setForm(f => ({ ...f, slug: e.target.value })) }}
            className="flex-1 border rounded-xl px-3 py-2 text-sm font-mono min-w-0"
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t('admin.content.guides.btn.copied')}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                {t('admin.content.guides.btn.copyUrl')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Emoji */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}>{t('admin.content.guides.lbl.emoji')}</label>
        <input
          value={form.emoji ?? ''}
          onChange={e => setForm(f => ({ ...f, emoji: e.target.value || null }))}
          placeholder="e.g. 📦"
          className="w-full border rounded-xl px-3 py-2 text-sm text-center"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        />
      </div>

      {/* Cover image */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}>{t('admin.content.guides.lbl.coverImage')}</label>
        <CoverImageUploader
          value={form.cover_image_url}
          onUploading={setCoverUploading}
          onChange={url => setForm(f => ({ ...f, cover_image_url: url }))}
        />
      </div>

      {/* Access roles */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
          style={{ color: 'var(--text-secondary)' }}>{t('admin.content.guides.lbl.accessRoles')}</label>
        <RoleSelector
          roles={ALL_ROLES}
          selected={form.access_roles}
          onChange={access_roles => setForm(f => ({ ...f, access_roles }))}
        />
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: 'var(--border-default)' }} />

      {/* Publish toggle */}
      <div className="flex items-center gap-3">
        <AdminStatusBadge
          variant={form.is_published ? 'active' : 'inactive'}
          label={form.is_published ? 'Published' : 'Draft'}
        />
        <button
          onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {form.is_published ? t('admin.content.guides.btn.unpublish') : t('admin.content.guides.btn.publish')}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--brand-crimson)' }}>{error}</p>}

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={isPending || !form.slug || !form.title.en || coverUploading}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? t('admin.content.guides.btn.saving') : t('admin.content.guides.btn.save')}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('admin.content.guides.btn.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function GuideEditLayout({ guide }: { guide: Guide }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>({
    slug: guide.slug,
    title: guide.title,
    cover_image_url: guide.cover_image_url,
    emoji: guide.emoji,
    body: Array.isArray(guide.body) ? guide.body : [],
    access_roles: Array.isArray(guide.access_roles) ? guide.access_roles : [...ALL_ROLES],
    is_published: guide.is_published,
    sort_order: guide.sort_order,
  })
  const [coverUploading, setCoverUploading] = useState(false)
  const [mutError, setMutError] = useState<string | null>(null)

  const updateGuide = useMutation({
    mutationFn: (body: FormState) =>
      fetch(`/api/admin/guides/${guide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error)
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-guides'] })
      setMutError(null)
      router.push('/admin/content?tab=guides')
    },
    onError: (e: Error) => setMutError(e.message),
  })

  function handleCancel() {
    router.push('/admin/content?tab=guides')
  }

  const sharedPanelProps = {
    form,
    setForm,
    isPending: updateGuide.isPending,
    coverUploading,
    setCoverUploading,
    error: mutError,
    onSave: () => updateGuide.mutate(form),
    onCancel: handleCancel,
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP layout (lg+)
          Left panel: fixed 320px metadata + always-visible save
          Right panel: flex-1, block editor, independent scroll
          ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        {/* Left panel */}
        <div
          className="w-80 flex-shrink-0 overflow-y-auto border-r p-6"
          style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-card)' }}
        >
          {/* Back nav */}
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 text-xs font-semibold mb-6 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Guides
          </button>
          <h1 className="text-base font-bold mb-6 truncate" style={{ color: 'var(--text-primary)' }}>
            {guide.title.en || guide.slug}
          </h1>
          <LeftPanel {...sharedPanelProps} />
        </div>

        {/* Right panel — block editor */}
        <div className="flex-1 overflow-y-auto p-8">
          <BlockEditor
            blocks={form.body}
            onChange={body => setForm(f => ({ ...f, body }))}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE layout (< lg)
          Single column: back nav → title → metadata → block editor → save
          ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden px-4 py-6 space-y-6">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Guides
        </button>
        <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {guide.title.en || guide.slug}
        </h1>
        <LeftPanel {...sharedPanelProps} />
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest mb-2 block"
            style={{ color: 'var(--text-secondary)' }}>Body Blocks</label>
          <BlockEditor
            blocks={form.body}
            onChange={body => setForm(f => ({ ...f, body }))}
          />
        </div>
      </div>
    </>
  )
}
