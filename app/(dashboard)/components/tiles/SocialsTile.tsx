'use client'

import { useQuery } from '@tanstack/react-query'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'

type SocialPost = {
  id: string
  platform: string
  post_url: string
  caption: string | null
  thumbnail_url: string | null
  is_pinned: boolean
  created_at: string
}

type SocialsData = {
  post: SocialPost | null
}

function thumbnailSrc(url: string): string {
  return `/api/socials/thumbnail?src=${encodeURIComponent(url)}`
}

function timeAgoMs(diff: number, t: (k: string) => string): string {
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 60)  return `${mins}${t('home.time.minutesAgo')}`
  if (hours < 24) return `${hours}${t('home.time.hoursAgo')}`
  return `${days}${t('home.time.daysAgo')}`
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function SocialsTile({
  colSpan = 4,
  mobileColSpan = 12,
  rowSpan,
  style,
}: {
  colSpan?: number
  mobileColSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { t } = useLanguage()
  const { data, isLoading } = useQuery<SocialsData>({
    queryKey: ['socials'],
    queryFn: () => fetch('/api/socials').then(r => r.json()),
    staleTime: 300 * 1000,
  })

  const post = data?.post ?? null

  function timeAgo(dateStr: string): string {
    return timeAgoMs(Date.now() - new Date(dateStr).getTime(), t)
  }

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      mobileColSpan={mobileColSpan}
      rowSpan={rowSpan}
      className="bento-tile flex flex-col relative overflow-hidden"
      style={{ animationDelay: '350ms', ...style }}
    >
      {/* Decorative background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/socials-image.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.15,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div className="relative flex flex-col flex-1" style={{ zIndex: 1 }}>
        {isLoading && (
          <div className="flex-1 flex flex-col justify-center gap-3 mt-3">
            <div className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
          </div>
        )}

        {!isLoading && !post && (
          <p className="font-body text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
            {t('home.socials.comingSoon')}
          </p>
        )}

        {!isLoading && post && (
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 group mt-3 flex-1"
            style={{ textDecoration: 'none' }}
          >
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
                <span className="text-xs font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>{post.platform}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.55 }}>· {timeAgo(post.created_at)}</span>
              </div>
              {post.caption ? (
                <p
                  className="text-xs leading-relaxed group-hover:underline"
                  style={{
                    color: 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {post.caption}
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>{t('home.socials.viewPost')}</p>
              )}
            </div>

            {post.thumbnail_url && (
              <div
                className="flex-shrink-0 rounded-lg overflow-hidden self-start"
                style={{ width: 64, height: 64, backgroundColor: 'rgba(0,0,0,0.06)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailSrc(post.thumbnail_url)}
                  alt={`${post.platform} ${t('home.socials.postAlt')}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
          </a>
        )}
      </div>
    </BentoCard>
  )
}
