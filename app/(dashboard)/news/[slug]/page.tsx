import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { translate } from '@/lib/i18n/translations'
import { formatDate } from '@/lib/format'
import type { Lang } from '@/lib/i18n/translations'

type Announcement = {
  id: string
  slug: string
  titles: Record<string, string>
  contents: Record<string, string>
  access_roles: string[]
  is_active: boolean
  created_at: string
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let role = 'guest'
  try {
    const { userId } = await auth()
    if (userId) {
      const supabase = createServiceClient()
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('clerk_id', userId).single()
      if (profile?.role) role = profile.role
    }
  } catch { /* unauthenticated */ }

  const supabase = createServiceClient()
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, slug, titles, contents, access_roles, is_active, created_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!announcement) redirect('/guides?type=news')

  const a = announcement as unknown as Announcement
  const accessRoles = a.access_roles as string[]
  if (!accessRoles.includes(role)) redirect('/guides?type=news')

  const cookieStore = await cookies()
  const lang: Lang = cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'

  const title = a.titles[lang] ?? a.titles.en ?? ''
  const content = a.contents[lang] ?? a.contents.en ?? ''

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 xl:px-8 py-8 pb-16">

      {/* ── MOBILE ── */}
      <div className="md:hidden">
        <Link
          href="/guides?type=news"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 pill-link-crimson"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {translate('guides.back.news', lang)}
        </Link>
        <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(a.created_at)}
        </p>
        <h1 className="font-display text-2xl font-semibold leading-tight mb-6"
          style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {content && (
          <p className="font-body text-base leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}>
            {content}
          </p>
        )}
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <Link
          href="/guides?type=news"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 pill-link-crimson"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {translate('guides.back.news', lang)}
        </Link>
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <h1 className="font-display text-3xl font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
          <span className="text-sm shrink-0" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(a.created_at)}
          </span>
        </div>
        {content && (
          <div className="max-w-2xl">
            <p className="font-body text-base leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}>
              {content}
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
