import PageContainer from '@/components/layout/PageContainer'
import PageHeading from '@/components/layout/PageHeading'

export default function AboutPage() {
  return (
    <PageContainer>
      <PageHeading title="About Us" subtitle="Our story & vision" />
      <div className="max-w-2xl pb-16 space-y-6">
        <p className="text-base leading-relaxed" style={{ color: 'var(--stone)' }}>
          teamenjoyVD is a community built on the foundation of growth, leadership, and purpose.
          We are part of the N21 network — a group of entrepreneurs committed to building
          businesses and lives worth living.
        </p>
        <p className="text-base leading-relaxed" style={{ color: 'var(--stone)' }}>
          Based in Sofia, Bulgaria, our team brings together individuals from across the country
          united by a shared vision: to build something meaningful together, support each other's
          development, and create lasting impact in our communities.
        </p>
        <p className="text-base leading-relaxed" style={{ color: 'var(--stone)' }}>
          Whether you're here for your first event or your hundredth, welcome to the team.
        </p>
      </div>
    </PageContainer>
  )
}