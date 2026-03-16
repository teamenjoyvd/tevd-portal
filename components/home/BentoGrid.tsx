import Link from 'next/link'

type Announcement = {
  id: string
  titles: Record<string, string>
  contents: Record<string, string>
  is_active: boolean
}

type QuickLink = {
  id: string
  label: string
  url: string
  icon_name: string
}

type Profile = {
  id: string
  first_name: string
  last_name: string
  role: string
  abo_number: string | null
}

type Caret = {
  text: string
}

type BentoGridProps = {
  announcement: Announcement | null
  profile: Profile | null
  quickLinks: QuickLink[]
  carets: Caret[]
  isAuthenticated: boolean
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', core: 'Core', member: 'Member', guest: 'Guest',
}

export default function BentoGrid({
  announcement, profile, quickLinks, carets, isAuthenticated,
}: BentoGridProps) {
  const announcementTitle   = announcement?.titles?.en ?? announcement?.titles?.bg ?? null
  const announcementContent = announcement?.contents?.en ?? announcement?.contents?.bg ?? null
  const initials = profile
    ? `${profile.first_name[0] ?? ''}${profile.last_name[0] ?? ''}`.toUpperCase()
    : '?'
  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : ''

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

      {/* ── Featured Announcement — 2×2 ─────────────────────── */}
      <div
        className="md:col-span-2 md:row-span-2 rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[220px] md:min-h-[300px]"
        style={{ backgroundColor: 'var(--eggshell)', border: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
            style={{ color: 'var(--stone)' }}>
            Latest announcement
          </p>
          {announcementTitle ? (
            <>
              <h2 className="font-serif text-2xl md:text-3xl font-bold leading-tight mb-3"
                style={{ color: 'var(--deep)' }}>
                {announcementTitle.split(' ').slice(0, -1).join(' ')}{' '}
                <span style={{ color: 'var(--crimson)' }}>
                  {announcementTitle.split(' ').slice(-1)[0]}
                </span>
              </h2>
              {announcementContent && (
                <p className="text-sm leading-relaxed"
                  style={{
                    color: 'var(--stone)',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                  {announcementContent}
                </p>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center">
              <p className="text-sm" style={{ color: 'var(--stone)' }}>
                No announcements yet. Check back soon.
              </p>
            </div>
          )}
        </div>
        <Link
          href="/notifications"
          className="mt-5 text-xs font-semibold tracking-widest uppercase hover:underline self-start"
          style={{ color: 'var(--crimson)' }}
        >
          View all →
        </Link>
      </div>

      {/* ── Profile / Rank — 1×1 ────────────────────────────── */}
      <div
        className="rounded-3xl p-5 flex flex-col justify-between min-h-[144px]"
        style={{ backgroundColor: isAuthenticated ? 'var(--forest)' : 'var(--deep)' }}
      >
        {isAuthenticated && profile ? (
          <>
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              {initials}
            </div>
            <div>
              <p className="font-serif text-base font-semibold text-white leading-snug">
                {fullName}
              </p>
              {profile.abo_number && (
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  ABO {profile.abo_number}
                </p>
              )}
              <span
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-2 inline-block"
                style={{ backgroundColor: 'rgba(224,122,95,0.3)', color: 'var(--sienna)' }}
              >
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </div>
          </>
        ) : (
          <>
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.4)" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Members portal</p>
              <Link
                href="/sign-in"
                className="text-xs font-semibold mt-1 inline-block hover:underline"
                style={{ color: 'var(--sienna)' }}
              >
                Sign in →
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ── Quick Links — 1×1 ───────────────────────────────── */}
      <div
        className="rounded-3xl p-5 min-h-[144px] flex flex-col"
        style={{ backgroundColor: 'white', border: '1px solid rgba(0,0,0,0.05)' }}
      >
        <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3"
          style={{ color: 'var(--stone)' }}>
          Quick access
        </p>
        {quickLinks.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 flex-1">
            {quickLinks.slice(0, 4).map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium truncate transition-colors hover:bg-black/[0.04]"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  color: 'var(--deep)',
                }}
              >
                <span style={{ color: 'var(--crimson)', flexShrink: 0 }}>→</span>
                <span className="truncate">{link.label}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs flex-1 flex items-center" style={{ color: 'var(--stone)' }}>
            No quick links configured.
          </p>
        )}
      </div>

      {/* ── Carets Band — 3×1 ───────────────────────────────── */}
      {carets.length > 0 && (
        <div
          className="md:col-span-3 rounded-3xl px-6 py-4 flex flex-wrap gap-x-6 gap-y-2 items-center"
          style={{ backgroundColor: 'var(--sienna)' }}
        >
          {carets.map((c, i) => (
            <span key={i} className="text-sm font-medium text-white">
              {c.text}
            </span>
          ))}
        </div>
      )}

    </div>
  )
}