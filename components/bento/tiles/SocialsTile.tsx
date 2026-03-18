'use client'

import { useQuery } from '@tanstack/react-query'
import BentoCard, { Eyebrow } from '@/components/bento/BentoCard'

type InstagramPost = {
  id: string
  caption: string | null
  media_type: string
  media_url: string | null
  thumbnail_url: string | null
  permalink: string
  timestamp: string
} | null

type FacebookPost = {
  message: string | null
  full_picture: string | null
  permalink_url: string
  created_time: string
} | null

type SocialsData = {
  instagram: InstagramPost
  facebook: FacebookPost
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
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

function PostCard({
  platform,
  icon,
  thumbnail,
  caption,
  timestamp,
  href,
}: {
  platform: string
  icon: React.ReactNode
  thumbnail: string | null
  caption: string | null
  timestamp: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 group"
      style={{ textDecoration: 'none' }}
    >
      {thumbnail && (
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden"
          style={{ width: 56, height: 56, position: 'relative', backgroundColor: 'rgba(0,0,0,0.06)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={`${platform} post`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-secondary)' }}>
          {icon}
          <span className="text-xs font-medium">{platform}</span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>· {timeAgo(timestamp)}</span>
        </div>
        {caption && (
          <p
            className="text-xs leading-relaxed group-hover:underline"
            style={{
              color: 'var(--text-primary)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {caption}
          </p>
        )}
        {!caption && (
          <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>View post →</p>
        )}
      </div>
    </a>
  )
}

export default function SocialsTile({ colSpan = 4, rowSpan, halfWidthMobile }: { colSpan?: number; rowSpan?: number; halfWidthMobile?: boolean }) {
  const { data, isLoading } = useQuery<SocialsData>({
    queryKey: ['socials'],
    queryFn: () => fetch('/api/socials').then(r => r.json()),
    staleTime: 3600 * 1000, // 1 hour — matches server revalidate
  })

  const hasAny = data && (data.instagram !== null || data.facebook !== null)

  return (
    <BentoCard
      variant="default"
      colSpan={colSpan}
      rowSpan={rowSpan}
      halfWidthMobile={halfWidthMobile}
      className="bento-tile flex flex-col"
      style={{ animationDelay: '350ms' }}
    >
      <Eyebrow>Socials</Eyebrow>

      {isLoading && (
        <div className="flex-1 flex flex-col justify-center gap-3 mt-3">
          <div className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
          <div className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
        </div>
      )}

      {!isLoading && !hasAny && (
        <p className="font-body text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
          Social feed coming soon.
        </p>
      )}

      {!isLoading && hasAny && (
        <div className="flex flex-col gap-4 mt-4 flex-1">
          {data.instagram && (
            <PostCard
              platform="Instagram"
              icon={<InstagramIcon />}
              thumbnail={data.instagram.thumbnail_url ?? data.instagram.media_url}
              caption={data.instagram.caption}
              timestamp={data.instagram.timestamp}
              href={data.instagram.permalink}
            />
          )}
          {data.facebook && (
            <PostCard
              platform="Facebook"
              icon={<FacebookIcon />}
              thumbnail={data.facebook.full_picture}
              caption={data.facebook.message}
              timestamp={data.facebook.created_time}
              href={data.facebook.permalink_url}
            />
          )}
        </div>
      )}
    </BentoCard>
  )
}
