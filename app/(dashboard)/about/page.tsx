import Image from 'next/image'
import BentoCard from '@/components/bento/BentoCard'
import AboutMapTile from '@/components/about/AboutMapTile'

// ── Shared content blocks ─────────────────────────────────────────────────

const HEADING = (
  <div
    className="rounded-2xl flex items-center justify-end px-6 py-4 h-full"
    style={{ backgroundColor: 'var(--brand-stone)' }}
  >
    <h1 className="font-display text-3xl font-semibold text-right" style={{ color: 'var(--bg-global)' }}>
      About Us
    </h1>
  </div>
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
      what we&apos;re all about. If you stumbled upon us all by yourself, kudos! Slide into
      our DMs and let&apos;s have a chat. We love meeting new folks.
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
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
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
          max-w-[1280px] centered, 12-col CSS grid
          Row 1: [col-3 heading][col-9 text rowSpan-3]
          Row 2: [col-3 empty]
          Row 3: [col-3 empty]
          Row 4: [col-3 hero][col-3 empty][col-3 email][col-3 map]
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'auto',
          }}
        >
          {/* Row 1 col 1-3: heading box */}
          <div style={{ gridColumn: 'span 3' }} className="flex items-start">
            {HEADING}
          </div>

          {/* Row 1-3 col 4-12: body text, rowSpan 3 */}
          <div
            style={{ gridColumn: 'span 9', gridRow: 'span 3' }}
            className="flex flex-col justify-start"
          >
            {BODY}
          </div>

          {/* Row 2 col 1-3: empty */}
          <div style={{ gridColumn: 'span 3' }} />

          {/* Row 3 col 1-3: empty */}
          <div style={{ gridColumn: 'span 3' }} />

          {/* Row 4 col 1-3: square hero image */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              gridColumn: 'span 3',
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

          {/* Row 4 col 4-6: empty */}
          <div style={{ gridColumn: 'span 3' }} />

          {/* Row 4 col 7-9: email */}
          <div style={{ gridColumn: 'span 3', minHeight: 120 }}>
            {EMAIL_TILE}
          </div>

          {/* Row 4 col 10-12: map */}
          <AboutMapTile
            gridColumn="span 3"
            style={{ minHeight: 120, backgroundColor: 'var(--brand-teal)' }}
          />

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md) — unchanged
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">

        <div>{HEADING}</div>

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

        <div>{BODY}</div>

        <div className="grid grid-cols-2 gap-3">
          <div style={{ minHeight: 96 }}>{EMAIL_TILE}</div>
          <AboutMapTile style={{ minHeight: 96, backgroundColor: 'var(--brand-teal)' }} />
        </div>

      </div>

    </div>
  )
}
