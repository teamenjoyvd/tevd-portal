import Image from 'next/image'

export function HeroBento() {
  return (
    <div
      className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-8"
      style={{ backgroundColor: '#f2ede3' }}
    >
      {/* Top: wordmark + tagline */}
      <div className="flex items-start justify-between">
        <div>
          <span
            className="font-display text-sm font-bold tracking-widest uppercase"
            style={{ color: 'var(--brand-forest)' }}
          >
            TEAMENJOY
            <span style={{ color: 'var(--brand-crimson)' }}>VD</span>
          </span>
          <h1
            className="mt-4 font-display text-3xl font-bold leading-snug"
            style={{ color: '#2c2c2a' }}
          >
            Your business,
            <br />
            finally organised.
          </h1>
          <p
            className="mt-3 max-w-xs font-body text-sm leading-relaxed"
            style={{ color: '#5f5e5a' }}
          >
            The operating layer for teams that move fast and need clarity.
          </p>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2">
        {['Client management', 'Project tracking', 'Financials', 'Trip planning'].map((pill) => (
          <span
            key={pill}
            className="rounded-full px-3 py-1 font-body text-xs font-medium"
            style={{
              background: 'rgba(45,74,62,0.10)',
              color: '#2d4a3e',
              border: '0.5px solid rgba(45,74,62,0.20)',
            }}
          >
            {pill}
          </span>
        ))}
      </div>

      {/* Founders image — cream bg bleeds into card, no visible frame */}
      <div className="relative mt-auto flex justify-center">
        <Image
          src="/founders-hero.png"
          alt="D and V — founders of teamenjoyVD"
          width={360}
          height={340}
          priority
          className="object-contain object-bottom"
          style={{ marginBottom: '-2rem' }}
        />
      </div>

      {/* Founders label row */}
      <div
        className="flex justify-center gap-12 font-body text-xs font-medium tracking-wide"
        style={{ color: '#888780', marginTop: '-0.5rem', position: 'relative', zIndex: 10 }}
      >
        <span>D · Co-founder</span>
        <span>V · Co-founder</span>
      </div>
    </div>
  )
}
