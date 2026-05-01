import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { translate } from '@/lib/i18n/translations'
import type { Lang } from '@/lib/i18n/translations'
import GuideBody from './components/GuideBody'

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  body: unknown[] | null
  access_roles: string[]
}

export default async function LibraryDetailPage({
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
  const { data: guide } = await supabase
    .from('guides')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!guide) redirect('/library')

  const accessRoles = guide.access_roles as string[]
  if (!accessRoles.includes(role)) redirect('/library')

  const cookieStore = await cookies()
  const lang: Lang = cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'

  const g = guide as unknown as Guide
  const title = (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 xl:px-8 py-8 pb-16">

      {/* Back link */}
      <Link
        href="/library"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 pill-link-crimson"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {translate('guides.back', lang)}
      </Link>

      {/* Cover image */}
      {g.cover_image_url && (
        <div className="rounded-2xl overflow-hidden mb-10" style={{ maxHeight: 420 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={g.cover_image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Title */}
      <h1
        className="font-display text-3xl font-semibold leading-tight mb-8"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h1>

      {/* Body */}
      <GuideBody blocks={g.body} lang={lang} />
    </div>
  )
}
