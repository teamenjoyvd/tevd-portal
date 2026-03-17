import PageHeading from '@/components/layout/PageHeading'
import PageContainer from '@/components/layout/PageContainer'

export default function AboutPage() {
  return (
    <>
      <PageHeading title="About Us" subtitle="Our story & vision" />
      <PageContainer>
        <div className="max-w-2xl py-10 pb-16 space-y-6">
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Hey there!
          </p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            We&apos;re Vera &amp; Deniz, two folks living it up in the vibrant city of Sofia, Bulgaria.
            We&apos;re all about good vibes, delicious grub, and that perfect cup of coffee ☕️
          </p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            But hey, there&apos;s more to us than just our love for the simple pleasures. We&apos;re all
            about forging meaningful connections that stand the test of time. We&apos;re on a mission
            to build rock-solid relationships with like-minded individuals who share our passion
            and vision. So, if you&apos;ve made it to our corner of the web, you must be on the hunt
            for something special.
          </p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Reach out to the person who directed you here to dig deeper into what we&apos;re all about.
            And if you stumbled upon us all by yourself, kudos! Slide into our DMs and let&apos;s have
            a chat. We love meeting new folks.
          </p>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Get in touch via email or any of the socials linked below.
          </p>
        </div>
      </PageContainer>
    </>
  )
}