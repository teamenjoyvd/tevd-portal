import Image from 'next/image'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'
import AboutMapTile from '@/components/about/AboutMapTile'

// Reusable empty gutter cell — no card, no background, just grid space
function Gutter({ cols }: { cols: number }) {
  return <div style={{ gridColumn: `span ${cols}` }} aria-hidden="true" />
}

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">
      <BentoGrid>

        {/* ── ROW 1: ∅ col-2 | heading col-2 (transparent) | text col-4 ×3 (transparent) | ∅ col-2 ── */}

        <Gutter cols={2} />

        {/* col-2: "About Us" heading — transparent, crimson */}
        <div style={{ gridColumn: 'span 2' }} className="flex items-start pt-1">
          <h1
            className="font-display text-3xl font-semibold leading-tight"
            style={{ color: 'var(--brand-crimson)' }}
          >
            About Us
          </h1>
        </div>

        {/* col-4 rowSpan-3: body copy — transparent */}
        <div
          style={{ gridColumn: 'span 4', gridRow: 'span 3' }}
          className="flex flex-col gap-4 justify-center"
        >
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

        <Gutter cols={2} />

        {/* ── ROW 2: ∅ col-2 | ∅ col-2 | hero col-2 | [text cont] | ∅ col-2 ── */}

        <Gutter cols={2} />
        <Gutter cols={2} />

        {/* col-2: hero image */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            gridColumn: 'span 2',
            backgroundColor: 'var(--bg-global)',
            minHeight: 160,
          }}
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

        {/* text continues in col 5–8 (rowSpan from row 1) */}

        <Gutter cols={2} />

        {/* ── ROW 3: ∅ col-2 | ∅ col-2 | map col-2 | [text cont] | ∅ col-2 ── */}

        <Gutter cols={2} />
        <Gutter cols={2} />

        {/* col-2: mapbox */}
        <AboutMapTile />

        {/* text continues in col 5–8 (rowSpan from row 1) */}

        <Gutter cols={2} />

        {/* ── ROW 4: ∅ col-2 | instagram col-2 | email col-2 | CTA col-4 | ∅ col-2 ── */}

        <Gutter cols={2} />

        {/* col-2: instagram */}
        <BentoCard variant="teal" colSpan={2} className="flex flex-col items-center justify-center gap-2">
          <a
            href="https://instagram.com/teamenjoyvd"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
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

        {/* col-2: email */}
        <BentoCard variant="forest" colSpan={2} className="flex flex-col items-center justify-center gap-2">
          <a
            href="mailto:teamenjoyvd@gmail.com"
            aria-label="Email us"
            className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
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

        {/* col-4: CTA text */}
        <BentoCard variant="default" colSpan={4} className="flex items-center">
          <p className="text-base leading-relaxed font-body" style={{ color: 'var(--text-secondary)' }}>
            And if you stumbled upon us all by yourself, kudos! Slide into our DMs and
            let&apos;s have a chat. We love meeting new folks.
          </p>
        </BentoCard>

        <Gutter cols={2} />

      </BentoGrid>
    </div>
  )
}
