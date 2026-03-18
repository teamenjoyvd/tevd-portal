import Image from 'next/image'
import BentoCard from '@/components/bento/BentoCard'

// ── Shared content blocks ─────────────────────────────────────────────────

const HEADING = (
  <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--brand-stone)' }}>
    About Us
  </h1>
)

const BODY = (
  <div className="flex flex-col gap-4">
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--brand-stone)' }}>
      We&apos;re Vera &amp; Deniz, two folks living it up in the vibrant city of Sofia, Bulgaria.
      We&apos;re all about good vibes, delicious grub, and that perfect cup of coffee ☕️
    </p>
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--brand-stone)' }}>
      But hey, there&apos;s more to us than just our love for the simple pleasures. We&apos;re all
      about forging meaningful connections that stand the test of time. We&apos;re on a mission
      to build rock-solid relationships with like-minded individuals who share our passion
      and vision.
    </p>
    <p className="text-base leading-relaxed font-body" style={{ color: 'var(--brand-stone)' }}>
      So, if you&apos;ve made it to our corner of the web, you must be on the hunt for
      something special. Reach out to the person who directed you here to dig deeper into
      what we&apos;re all about.
    </p>
  </div>
)

const EMAIL_TILE = (
  <BentoCard variant="crimson" className="flex flex-col items-center justify-center gap-2 h-full">
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

const CTA_TILE = (
  <BentoCard variant="forest" className="flex items-center justify-center h-full">
    <p className="text-sm leading-relaxed font-body text-center" style={{ color: 'rgba(242,239,232,0.75)' }}>
      Slide into our DMs and let&apos;s have a chat.
    </p>
  </BentoCard>
)

// ── Page ──────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          max-w-[960px] centered, 8-col CSS grid
          Row 1: [col-2 heading][col-6 text rowSpan-3]
          Row 2: [col-2 empty  ][col-2 empty          ]
          Row 3: [col-2 empty  ][col-2 empty          ]
          Row 4: [col-2 hero   ][col-2 empty][col-2 email][col-2 cta]
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
          {/* Row 1 col 1-2: heading */}
          <div
            style={{ gridColumn: 'span 2' }}
            className="flex items-start pt-1"
          >
            {HEADING}
          </div>

          {/* Row 1-3 col 3-8: body text, rowSpan 3 */}
          <div
            style={{ gridColumn: 'span 6', gridRow: 'span 3' }}
            className="flex flex-col justify-center"
          >
            {BODY}
          </div>

          {/* Row 2 col 1-2: empty */}
          <div style={{ gridColumn: 'span 2' }} />

          {/* Row 3 col 1-2: empty */}
          <div style={{ gridColumn: 'span 2' }} />

          {/* Row 4 col 1-2: square hero image */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              gridColumn: 'span 2',
              aspectRatio: '1 / 1',
              minHeight: 80,
            }}
          >
            <Image
              src="/about-hero.png"
              alt="Vera & Deniz"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Row 4 col 3-4: empty */}
          <div style={{ gridColumn: 'span 2' }} />

          {/* Row 4 col 5-6: email — crimson */}
          <div style={{ gridColumn: 'span 2', minHeight: 80 }}>
            {EMAIL_TILE}
          </div>

          {/* Row 4 col 7-8: CTA — forest */}
          <div style={{ gridColumn: 'span 2', minHeight: 80 }}>
            {CTA_TILE}
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          Simple vertical stack
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">

        {/* Heading */}
        <div>{HEADING}</div>

        {/* Hero image — square */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ aspectRatio: '1 / 1', width: '100%' }}
        >
          <Image
            src="/about-hero.png"
            alt="Vera & Deniz"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Body text */}
        <div>{BODY}</div>

        {/* Email + CTA side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div style={{ minHeight: 96 }}>{EMAIL_TILE}</div>
          <div style={{ minHeight: 96 }}>{CTA_TILE}</div>
        </div>

      </div>

    </div>
  )
}
