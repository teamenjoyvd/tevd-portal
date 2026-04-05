import Link from 'next/link'

type Props = {
  title: string
  content: string | null
}

export default function AnnouncementTile({ title, content }: Props) {
  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Link href="/announcements" className="font-body text-[11px] font-bold tracking-widest uppercase pill-link-crimson">
          View all →
        </Link>
      </div>
      <div className="flex-1">
        <h2
          className="font-display text-xl font-semibold leading-snug mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
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
