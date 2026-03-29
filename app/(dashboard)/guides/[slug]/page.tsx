import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeading from '@/components/layout/PageHeading'
import BentoCard from '@/components/bento/BentoCard'

type Block = {
  type: 'heading' | 'paragraph' | 'callout'
  content: { en: string; bg: string }
  emoji?: string
}

type Guide = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  body: Block[]
  access_roles: string[]
}

function getContent(block: Block, lang: string): string {
  return (block.content as Record<string, string>)[lang]
    ?? block.content.en
    ?? ''
}

export default async function GuideDetailPage({
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

  if (!guide) redirect('/guides')

  const accessRoles = guide.access_roles as string[]
  if (!accessRoles.includes(role)) redirect('/guides')

  const g = guide as unknown as Guide
  // Server component — default to EN; client-side lang switching not available here
  const lang = 'en'
  const title = (g.title as Record<string, string>)[lang] ?? g.title.en ?? ''

  return (
    <>
      <PageHeading title={title} subtitle="Guide" />
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

        {g.cover_image_url && (
          <div className="h-80 rounded-2xl overflow-hidden mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={g.cover_image_url}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-8">
          {g.emoji && <span className="text-4xl">{g.emoji}</span>}
          <h1 className="font-display text-3xl font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>

        <div className="max-w-2xl space-y-6">
          {(g.body as Block[]).map((block, i) => {
            const content = getContent(block, lang)
            if (!content) return null

            if (block.type === 'heading') {
              return (
                <h2 key={i} className="font-display text-xl font-semibold pt-4"
                  style={{ color: 'var(--text-primary)' }}>
                  {content}
                </h2>
              )
            }

            if (block.type === 'callout') {
              return (
                <BentoCard key={i} variant="edge-info" colSpan={12}>
                  <div className="flex items-start gap-3">
                    {block.emoji && (
                      <span className="text-xl flex-shrink-0 mt-0.5">{block.emoji}</span>
                    )}
                    <p className="text-sm leading-relaxed font-body"
                      style={{ color: 'var(--text-primary)' }}>
                      {content}
                    </p>
                  </div>
                </BentoCard>
              )
            }

            return (
              <p key={i} className="text-base leading-relaxed font-body"
                style={{ color: 'var(--text-secondary)' }}>
                {content}
              </p>
            )
          })}
        </div>
      </div>
    </>
  )
}
