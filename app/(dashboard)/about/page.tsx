import Image from 'next/image'
import BentoCard from '@/components/bento/BentoCard'
import AboutMapTile from '@/components/about/AboutMapTile'

// ── Shared content blocks ─────────────────────────────────────────────────

const HEADING = (
  <div className="flex items-center justify-end h-full px-2 py-4">
    <h1
      className="font-display text-3xl font-semibold text-right"
      style={{ color: 'var(--text-primary)' }}
    >
      About Us
    </h1>
  </div>
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
      what we&apos;re all about. If you stumbled upon us all by yourself, kudos! Slide into
      our DMs and let&apos;s have a chat. We love meeting new folks.
    </p>
  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          12-col CSS grid, explicit placement
          Row 1: [col 1–3 empty][col 4–6 heading][col 7–9 text rowspan 2][col 10–12 empty]
          Row 2: [col 1–6 empty]              [col 7–9 text cont.]   [col 10–12 empty]
          Row 3: [col 1–3 hero][col 4–6 empty][col 7–9 mailto]       [col 10–12 map]
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-[1280px] mx-auto px-4 sm:px-6 xl:px-8">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'minmax(120px, auto)',
          }}
        >
          {/* Row 1 col 1–3: empty spacer */}
          <div style={{ gridColumn: '1 / span 3', gridRow: '1' }} />

          {/* Row 1 col 4–6: heading — transparent card */}
          <div
            style={{
              gridColumn: '4 / span 3',
              gridRow: '1',
              borderRadius: 'var(--bento-radius)',
              padding: 'var(--bento-padding)',
            }}
          >
            {HEADING}
          </div>

          {/* Row 1–2 col 7–9: body text — transparent card */}
          <div
            style={{
              gridColumn: '7 / span 3',
              gridRow: '1 / span 2',
              borderRadius: 'var(--bento-radius)',
              padding: 'var(--bento-padding)',
            }}
          >
            {BODY}
          </div>

          {/* Row 1 col 10–12: empty spacer */}
          <div style={{ gridColumn: '10 / span 3', gridRow: '1' }} />

          {/* Row 2 col 1–6: empty spacer */}
          <div style={{ gridColumn: '1 / span 6', gridRow: '2' }} />

          {/* Row 2 col 10–12: empty spacer */}
          <div style={{ gridColumn: '10 / span 3', gridRow: '2' }} />

          {/* Row 3 col 1–3: square hero image */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              gridColumn: '1 / span 3',
              gridRow: '3',
              aspectRatio: '1 / 1',
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

          {/* Row 3 col 4–6: empty */}
          <div style={{ gridColumn: '4 / span 3', gridRow: '3' }} />

          {/* Row 3 col 7–9: mailto — crimson card with interactive-lift */}
          <BentoCard
            variant="crimson"
            className="flex flex-col items-center justify-center gap-2"
            style={{ gridColumn: '7 / span 3', gridRow: '3' }}
            onClick={() => { window.location.href = 'mailto:teamenjoyvd@gmail.com' }}
          >
            <a
              href="mailto:teamenjoyvd@gmail.com"
              aria-label="Email us"
              className="flex flex-col items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-parchment)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}
              >
                Email
              </span>
            </a>
          </BentoCard>

          {/* Row 3 col 10–12: map */}
          <AboutMapTile
            gridColumn="10 / span 3"
            style={{ gridColumn: '10 / span 3', gridRow: '3', minHeight: 120, backgroundColor: 'var(--brand-teal)' }}
          />

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md) — unchanged
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">

        <div
          style={{
            borderRadius: 'var(--bento-radius)',
            padding: 'var(--bento-padding)',
          }}
        >
          {HEADING}
        </div>

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

        <div
          style={{
            borderRadius: 'var(--bento-radius)',
            padding: 'var(--bento-padding)',
          }}
        >
          {BODY}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BentoCard
            variant="crimson"
            className="flex flex-col items-center justify-center gap-2"
            style={{ minHeight: 96 }}
            onClick={() => { window.location.href = 'mailto:teamenjoyvd@gmail.com' }}
          >
            <a
              href="mailto:teamenjoyvd@gmail.com"
              aria-label="Email us"
              className="flex flex-col items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--brand-parchment)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}
              >
                Email
              </span>
            </a>
          </BentoCard>
          <AboutMapTile style={{ minHeight: 96, backgroundColor: 'var(--brand-teal)' }} />
        </div>

      </div>

    </div>
  )
}
