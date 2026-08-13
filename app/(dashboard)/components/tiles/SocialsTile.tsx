'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import BentoCard from '@/components/bento/BentoCard'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { timeAgoMs } from '@/lib/format'
import { apiClient } from '@/lib/apiClient'

type SocialPost = {
  id: string
  platform: string
  post_url: string
  caption: string | null
  thumbnail_url: string | null
  is_pinned: boolean
  created_at: string
  posted_at: string | null
}

type SocialsData = {
  post: SocialPost | null
}

const STORAGE_URL_FRAGMENT = '/storage/v1/object/public/social-thumbnails/'

function thumbnailSrc(url: string): string {
  if (url.includes(STORAGE_URL_FRAGMENT)) return url
  return `/api/socials/thumbnail?src=${encodeURIComponent(url)}`
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

/**
 * SocialsTile — single responsive component (merged from SocialsTileDesktop/Mobile,
 * see issue #482). `colSpan`/`rowSpan` only take effect inside a CSS grid parent
 * (the desktop bento layout); they're harmless no-ops in the mobile flex stack.
 */
export default function SocialsTile({
  colSpan = 3,
  rowSpan,
  style,
}: {
  colSpan?: number
  rowSpan?: number
  style?: React.CSSProperties
}) {
  const { t } = useLanguage()
  const { data, isLoading } = useQuery<SocialsData>({
    queryKey: ['socials'],
    queryFn: () => apiClient('/api/socials'),
    staleTime: 300 * 1000,
  })

  const post = data?.post ?? null
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])

  function timeAgo(dateStr: string): string {
    if (now === null) return ''
    return timeAgoMs(now - new Date(dateStr).getTime(), t)
  }

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      rowSpan={rowSpan}
      className="bento-tile flex flex-col"
      style={{ animationDelay: '350ms', ...style }}
    >
      {isLoading && (
        <div className="flex-1 flex flex-col justify-center gap-3 mt-3 md:mt-0">
          <div className="h-14 rounded-container animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
        </div>
      )}

      {!isLoading && !post && (
        <p className="font-body text-xs mt-3 md:mt-0" style={{ color: 'var(--text-secondary)' }}>
          {t('home.socials.comingSoon')}
        </p>
      )}

      {!isLoading && post && (
        <a
          href={post.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 md:gap-4 group mt-3 md:mt-0 flex-1 md:items-center"
          style={{ textDecoration: 'none' }}
        >
          {post.thumbnail_url && (
            <div
              className="flex-shrink-0 rounded-container overflow-hidden self-start md:self-auto w-20 h-20 md:w-[100px] md:h-[100px] outline outline-2 outline-offset-1 outline-[rgba(0,0,0,0.08)] md:outline-0 md:shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
              style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailSrc(post.thumbnail_url)}
                alt={`${post.platform} ${t('home.socials.postAlt')}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div className="flex-1 min-w-0 flex flex-col justify-between md:justify-start md:gap-1.5">
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-0" style={{ color: 'var(--text-secondary)' }}>
              {post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
              <span className="text-xs font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
                {post.platform}
              </span>
              {now !== null && (
                <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.55 }}>
                  · {timeAgo(post.posted_at ?? post.created_at)}
                </span>
              )}
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
              <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                {t('home.socials.viewPost')}
              </p>
            )}
          </div>
        </a>
      )}
    </BentoCard>
  )
}
