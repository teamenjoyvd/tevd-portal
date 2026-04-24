'use client'

import { useState } from 'react'
import { RoleSelector } from '@/app/admin/components/RoleSelector'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { slugify, ALL_ROLES } from './GuideForm'

// ── Types ────────────────────────────────────────────────────────

export type NewsItem = {
  id: string
  titles: Record<string, string>
  contents: Record<string, string>
  access_roles: string[]
  is_active: boolean
  created_at: string
  sort_order: number
  slug: string | null
}

const LANGS = ['en', 'bg'] as const
type Lang = typeof LANGS[number]

export function emptyNewsItem(): Omit<NewsItem, 'id' | 'created_at'> {
  return {
    titles: { en: '', bg: '' },
    contents: { en: '', bg: '' },
    access_roles: [...ALL_ROLES],
    is_active: true,
    sort_order: 0,
    slug: '',
  }
}

// ── NewsForm ─────────────────────────────────────────────────────

export function NewsForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: Omit<NewsItem, 'id' | 'created_at'>
  onSave: (data: typeof initial) => void
  onCancel: () => void
  isPending: boolean
}): React.JSX.Element {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    ...initial,
    titles: { en: initial.titles.en ?? '', bg: initial.titles.bg ?? '' },
    contents: { en: initial.contents.en ?? '', bg: initial.contents.bg ?? '' },
    access_roles: Array.isArray(initial.access_roles) ? initial.access_roles : [...ALL_ROLES],
    slug: initial.slug ?? '',
  })
  const [slugManual, setSlugManual] = useState(!!(initial.slug))
  const [copied, setCopied] = useState(false)

  function handleTitleEnChange(val: string) {
    setForm(f => ({
      ...f,
      titles: { ...f.titles, en: val },
      slug: slugManual ? f.slug : slugify(val),
    }))
  }

  function copySlugUrl() {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/news/${form.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      {/* Titles — EN + BG side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        {(LANGS).map(lang => (
          <div key={lang}>
            <label
              className="text-xs font-semibold uppercase tracking-widest mb-1 block"
              style={{ color: 'var(--text-secondary)' }}
            >
              {lang === 'en' ? t('admin.content.news.lbl.titleEn') : t('admin.content.news.lbl.titleBg')}
            </label>
            <input
              value={form.titles[lang]}
              onChange={e =>
                lang === 'en'
                  ? handleTitleEnChange(e.target.value)
                  : setForm(f => ({ ...f, titles: { ...f.titles, bg: e.target.value } }))
              }
              className="w-full border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>
        ))}
      </div>

      {/* Slug */}
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-widest mb-1 block"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('admin.content.news.lbl.slug')}
        </label>
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('admin.content.news.btn.copied')}
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {t('admin.content.news.btn.copyUrl')}
              </>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('admin.content.news.slug.hint')}
        </p>
      </div>

      {/* Contents — EN + BG textareas */}
      <div className="grid grid-cols-2 gap-4">
        {(LANGS).map((lang: Lang) => (
          <div key={lang}>
            <label
              className="text-xs font-semibold uppercase tracking-widest mb-1 block"
              style={{ color: 'var(--text-secondary)' }}
            >
              {lang === 'en' ? t('admin.content.news.lbl.contentEn') : t('admin.content.news.lbl.contentBg')}
            </label>
            <textarea
              value={form.contents[lang]}
              onChange={e => setForm(f => ({ ...f, contents: { ...f.contents, [lang]: e.target.value } }))}
              rows={5}
              className="w-full border rounded-xl px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {t('admin.content.guides.markdownHint')}
            </p>
          </div>
        ))}
      </div>

      {/* Access roles */}
      <div>
        <label
          className="text-xs font-semibold uppercase tracking-widest mb-2 block"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('admin.content.news.lbl.accessRoles')}
        </label>
        <RoleSelector
          roles={ALL_ROLES}
          selected={form.access_roles}
          onChange={access_roles => setForm(f => ({ ...f, access_roles }))}
        />
      </div>

      {/* is_active toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {form.is_active ? t('admin.content.news.btn.deactivate') : t('admin.content.news.btn.activate')}
        </button>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: form.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.06)',
            color: form.is_active ? '#15803d' : 'var(--text-secondary)',
          }}
        >
          {form.is_active ? t('admin.content.news.status.active') : t('admin.content.news.status.inactive')}
        </span>
      </div>

      {/* Footer */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.titles.en}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--brand-crimson)' }}
        >
          {isPending ? t('admin.content.news.btn.saving') : t('admin.content.news.btn.save')}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
          style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        >
          {t('admin.content.news.btn.cancel')}
        </button>
      </div>
    </div>
  )
}
