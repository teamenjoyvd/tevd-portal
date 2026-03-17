import Image from 'next/image'
import PageHeading from '@/components/layout/PageHeading'
import BentoGrid from '@/components/bento/BentoGrid'
import BentoCard from '@/components/bento/BentoCard'

export default function AboutPage() {
  return (
    <>
      <PageHeading title="About Us" subtitle="Our story & vision" />
      <div className="py-8 pb-16">
        <BentoGrid>
          {/* Square image tile */}
          <div className="relative rounded-2xl overflow-hidden"
            style={{ gridColumn: 'span 4', aspectRatio: '1 / 1' }}>
            <Image
              src="/hero.png"
              alt="teamenjoyVD"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Intro text tile */}
          <BentoCard variant="default" colSpan={8} className="space-y-4">
            <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Hey there!
            </h2>
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

          {/* Contact / socials tile — full width */}
          <BentoCard variant="forest" colSpan={12} className="flex items-center justify-between gap-8">
            <p className="text-base leading-relaxed font-body"
              style={{ color: 'rgba(242,239,232,0.75)' }}>
              And if you stumbled upon us all by yourself, kudos! Slide into our DMs and
              let&apos;s have a chat. We love meeting new folks.
            </p>
            <div className="flex items-center gap-4 flex-shrink-0">
              <a href="mailto:teamenjoyvd@gmail.com"
                className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-parchment)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                Email
              </a>
              <a href="https://instagram.com/teamenjoyvd" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ color: 'var(--brand-parchment)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
                Instagram
              </a>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </>
  )
}
