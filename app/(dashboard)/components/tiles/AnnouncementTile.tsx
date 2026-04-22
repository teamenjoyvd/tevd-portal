import Link from 'next/link'

type Props = {
  title: string
  content: string | null
  slug?: string | null
}

export default function AnnouncementTile({ title, content, slug }: Props) {
  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Link href="/guides?type=news" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          View all →
        </Link>
      </div>
      <div className="flex-1">
        {slug ? (
          <Link href={`/news/${slug}`}>
            <h2
              className="font-display text-xl font-semibold leading-snug mb-2 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
          </Link>
        ) : (
          <h2
            className="font-display text-xl font-semibold leading-snug mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h2>
        )}
        {content && (
          <p
            className="font-body text-sm leading-relaxed"
            style={{
              color: 'var(--text-secondary)',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}
          >
            {content}
          </p>
        )}
      </div>
    </>
  )
}
