import Image from 'next/image'
import BentoCard from '@/components/bento/BentoCard'
import AboutMapTile from '@/components/about/AboutMapTile'

// ── Shared content blocks (reused across both layouts) ────────────────────

const HEADING = (
  <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-crimson)' }}>
    About Us
  </h1>
)

const BODY = (
  <div className="flex flex-col gap-4">
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      We&apos;re Vera &amp; Deniz, two folks living it up in the vibrant city of Sofia, Bulgaria.
      We&apos;re all about good vibes, delicious grub, and that perfect cup of coffee ☕️
    </p>
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      But hey, there&apos;s more to us than just our love for the simple pleasures. We&apos;re all
      about forging meaningful connections that stand the test of time. We&apos;re on a mission
      to build rock-solid relationships with like-minded individuals who share our passion
      and vision.
    </p>
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      So, if you&apos;ve made it to our corner of the web, you must be on the hunt for
      something special. Reach out to the person who directed you here to dig deeper into
      what we&apos;re all about.
    </p>
  </div>
)

const CTA = (
  <BentoCard variant="default" className="flex items-center h-full">
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
      And if you stumbled upon us all by yourself, kudos! Slide into our DMs and
      let&apos;s have a chat. We love meeting new folks.
    </p>
  </BentoCard>
)

const IG_TILE = (
  <BentoCard variant="teal" className="flex flex-col items-center justify-center gap-2 h-full">
    <a
      href="https://instagram.com/teamenjoyvd"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Instagram"
      className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke="var(--brand-parchment)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
      </svg>
      <span className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}>
        Instagram
      </span>
    </a>
  </BentoCard>
)

const EMAIL_TILE = (
  <BentoCard variant="forest" className="flex flex-col items-center justify-center gap-2 h-full">
    <a
      href="mailto:teamenjoyvd@gmail.com"
      aria-label="Email us"
      className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
        stroke="var(--brand-parchment)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
      <span className="text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}>
        Email
      </span>
    </a>
  </BentoCard>
)

// ── Page ──────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          max-w-[960px] centered, 8-col CSS grid, no BentoGrid wrapper
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-[960px] mx-auto px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'minmax(100px, auto)',
          }}
        >
          {/* Row 1+2+3 col 1-2: hero image, rowSpan 3 */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              gridColumn: 'span 2',
              gridRow: 'span 3',
              backgroundColor: 'var(--bg-global)',
              minHeight: 280,
            }}
          >
            <Image
              src="/hero.png"
              alt="Vera & Deniz"
              fill
              className="object-contain"
              style={{
                mixBlendMode: 'multiply',
                // grow 25% and shift toward bottom-left
                transform: 'scale(1.25) translate(-10%, 10%)',
                transformOrigin: 'center center',
              }}
              priority
            />
          </div>

          {/* Row 1 col 3-8: heading (transparent, crimson) */}
          <div
            style={{ gridColumn: 'span 6' }}
            className="flex items-start pt-1"
          >
            {HEADING}
          </div>

          {/* Row 2 col 3-8: body text (transparent), rowSpan 2 so it fills rows 2+3 */}
          <div
            style={{ gridColumn: 'span 6', gridRow: 'span 2' }}
            className="flex flex-col justify-center"
          >
            {BODY}
          </div>

          {/* Row 4 col 1-2: instagram — half height */}
          <div style={{ gridColumn: 'span 2', minHeight: 80, maxHeight: 80 }}>
            {IG_TILE}
          </div>

          {/* Row 4 col 3-4: email — half height */}
          <div style={{ gridColumn: 'span 2', minHeight: 80, maxHeight: 80 }}>
            {EMAIL_TILE}
          </div>

          {/* Row 4 col 5-6: map */}
          <AboutMapTile
            gridColumn="span 2"
            style={{ minHeight: 80, maxHeight: 80 }}
          />

          {/* Row 4 col 7-8: CTA */}
          <div style={{ gridColumn: 'span 2', minHeight: 80 }}>
            {CTA}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          Simple vertical stack, full-width, no grid
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">

        {/* Heading */}
        <div>{HEADING}</div>

        {/* Hero image */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ backgroundColor: 'var(--bg-global)', height: 260 }}
        >
          <Image
            src="/hero.png"
            alt="Vera & Deniz"
            fill
            className="object-contain"
            style={{ mixBlendMode: 'multiply' }}
            priority
          />
        </div>

        {/* Body text */}
        <div>{BODY}</div>

        {/* Instagram + Email side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div style={{ minHeight: 96 }}>{IG_TILE}</div>
          <div style={{ minHeight: 96 }}>{EMAIL_TILE}</div>
        </div>

        {/* Map */}
        <AboutMapTile style={{ minHeight: 160 }} />

        {/* CTA */}
        <div>{CTA}</div>

      </div>

    </div>
  )
}
