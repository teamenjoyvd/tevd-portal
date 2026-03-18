import Image from 'next/image'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">
      <BentoGrid>

        {/* col-4: hero image — mix-blend-mode:multiply blends white bg into page */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{
            gridColumn: 'span 4',
            backgroundColor: 'var(--bg-global)',
            minHeight: 320,
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

        {/* col-4: heading + body copy */}
        <BentoCard variant="default" colSpan={4} className="flex flex-col gap-4 justify-center">
          <h1 className="font-display text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            About Us
          </h1>
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
        </BentoCard>

        {/* col-2: email icon tile */}
        <BentoCard variant="forest" colSpan={2} className="flex flex-col items-center justify-center gap-3">
          <a
            href="mailto:teamenjoyvd@gmail.com"
            aria-label="Email us"
            className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="var(--brand-parchment)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <span className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}>
              Email
            </span>
          </a>
        </BentoCard>

        {/* col-2: instagram icon tile */}
        <BentoCard variant="teal" colSpan={2} className="flex flex-col items-center justify-center gap-3">
          <a
            href="https://instagram.com/teamenjoyvd"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="flex flex-col items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
              stroke="var(--brand-parchment)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
            </svg>
            <span className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--brand-parchment)', opacity: 0.7 }}>
              Instagram
            </span>
          </a>
        </BentoCard>

      </BentoGrid>
    </div>
  )
}
