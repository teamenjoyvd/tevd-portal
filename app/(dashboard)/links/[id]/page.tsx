import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeading from '@/components/layout/PageHeading'

type SiteLink = {
  id: string
  label: { en: string; bg: string }
  url: string
  access_roles: string[]
}

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

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
  const { data: link } = await supabase
    .from('links')
    .select('*')
    .eq('id', id)
    .single()

  if (!link) redirect('/guides')

  const l = link as unknown as SiteLink
  if (!l.access_roles.includes(role)) redirect('/guides')

  // Default to EN; server component cannot read client lang preference
  const label = (l.label as Record<string, string>).en ?? ''

  return (
    <>
      <PageHeading title={label} subtitle="Link" />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8 py-8 pb-16">

        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase mb-8 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to guides &amp; links
        </Link>

        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold leading-tight mb-6"
            style={{ color: 'var(--text-primary)' }}>
            {label}
          </h1>
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--brand-crimson)' }}
          >
            Open link
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
          <p className="mt-4 text-xs font-mono break-all" style={{ color: 'var(--text-secondary)' }}>
            {l.url}
          </p>
        </div>
      </div>
    </>
  )
}
