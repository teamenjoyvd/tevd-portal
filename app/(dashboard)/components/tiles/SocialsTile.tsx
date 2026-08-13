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

/** Platform profile pages — same two accounts the Footer links to. */
const PROFILE_URLS: Record<string, string> = {
  instagram: 'https://www.instagram.com/teamenjoyvd/',
  facebook: 'https://www.facebook.com/teamenjoyvd/',
}

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

  // Explicit absence check: '' is a stored value, not "no thumbnail" — but it is
  // also not a loadable src, so both fall back to the flat hero.
  const thumbnail =
    post === null || post.thumbnail_url === null || post.thumbnail_url === '' ? null : post.thumbnail_url
  const profileUrl = post === null ? undefined : PROFILE_URLS[post.platform]

  return (
    <BentoCard
      // No image to carry the hero: fall back to a filled card so the parchment
      // caption still has something dark under it. A scrim over nothing is the
      // broken-looking state this avoids.
      variant={post !== null && thumbnail === null ? 'forest' : 'default'}
      colSpan={colSpan}
      rowSpan={rowSpan}
      // min-h: in hero mode every child is absolutely positioned, so the card has
      // no intrinsic height. Both current call sites impose one (mobile
      // `minHeight: 200`, desktop grid row) — this keeps the tile from collapsing
      // if a future one does not.
      className={post !== null ? 'bento-tile relative overflow-hidden p-0 min-h-[200px]' : 'bento-tile flex flex-col'}
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
        <>
          {thumbnail !== null && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailSrc(thumbnail)}
                alt={`${post.platform} ${t('home.socials.postAlt')}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'var(--image-scrim)' }}
              />
            </>
          )}

          {/* Whole-tile navigation to the post. A sibling overlay, not a wrapper:
              wrapping would nest the profile pill inside this <a>. The content
              overlays are pointer-events-none so clicks reach it, and the pill
              sits above at z-20 to win the hit test. Same pattern as TripHeroTile. */}
          <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('home.socials.openPost')}
            className="absolute inset-0 z-10"
          />

          <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-2 px-5 pt-5 z-20 pointer-events-none">
            <span
              className="inline-flex items-center gap-1.5 font-body text-[11px] font-medium capitalize px-2 py-1 rounded-control min-w-0"
              style={{ backgroundColor: 'rgba(26,31,24,0.55)', color: 'var(--on-accent)' }}
            >
              {post.platform === 'instagram' ? <InstagramIcon /> : <FacebookIcon />}
              <span className="truncate">{post.platform}</span>
              {now !== null && (
                <span style={{ opacity: 0.75 }}>· {timeAgo(post.posted_at ?? post.created_at)}</span>
              )}
            </span>

            {profileUrl !== undefined && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-parchment pointer-events-auto whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'rgba(26,31,24,0.55)' }}
              >
                {t('home.socials.followLink')}
              </a>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 z-10 pointer-events-none">
            {post.caption !== null && post.caption !== '' ? (
              <p
                className="font-body text-sm leading-snug"
                style={{
                  color: 'var(--on-accent)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.caption}
              </p>
            ) : (
              <p className="font-body text-sm italic" style={{ color: 'var(--on-accent)', opacity: 0.85 }}>
                {t('home.socials.viewPost')}
              </p>
            )}
          </div>
        </>
      )}
    </BentoCard>
  )
}
