import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import PageHeading from '@/components/layout/PageHeading'
import BentoCard from '@/components/bento/BentoCard'

type Block = {
  type: 'heading' | 'paragraph' | 'callout'
  content: { en: string; bg: string }
  emoji?: string
}

type Howto = {
  id: string
  slug: string
  title: { en: string; bg: string }
  emoji: string | null
  cover_image_url: string | null
  body: Block[]
  access_roles: string[]
}

// Determine lang from Accept-Language or default to 'en'
function getLang(): 'en' | 'bg' { return 'en' }

function getContent(block: Block, lang: string): string {
  return (block.content as Record<string, string>)[lang]
    ?? block.content.en
    ?? ''
}

export default async function HowtoArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Resolve role for access gate
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
  const { data: howto } = await supabase
    .from('howtos')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!howto) redirect('/')

  const accessRoles = howto.access_roles as string[]
  if (!accessRoles.includes(role)) redirect('/')

  const h = howto as unknown as Howto
  const lang = getLang()
  const title = (h.title as Record<string, string>)[lang] ?? h.title.en ?? ''

  return (
    <>
      <PageHeading title={title} subtitle="How-to guide" />
      <div className="max-w-[1024px] mx-auto px-4 md:px-6 lg:px-8 py-8 pb-16">

        {/* Back link */}
        <Link href="/howtos"
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase mb-8 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          All how-tos
        </Link>

        {/* Cover image */}
        {h.cover_image_url && (
          <div className="h-80 relative rounded-2xl overflow-hidden mb-8">
            <Image
              src={h.cover_image_url}
              alt={title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          {h.emoji && <span className="text-4xl">{h.emoji}</span>}
          <h1 className="font-display text-3xl font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}>
            {title}
          </h1>
        </div>

        {/* Body blocks */}
        <div className="max-w-2xl space-y-6">
          {(h.body as Block[]).map((block, i) => {
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

            // paragraph
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
