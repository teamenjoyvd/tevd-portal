import Image from 'next/image'
import MailtoTile from './components/MailtoTile'
import AboutContent from './components/AboutContent'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          12-col CSS grid, max-w-[860px] centred
          Row 1: [1–2 gutter] [3–6 content — spans 2 rows] [7–10 photo]  [11–12 gutter]
          Row 2: [1–2 gutter] [3–6 content continued]      [7–10 mailto] [11–12 gutter]
          ════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block max-w-[860px] mx-auto px-4">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gap: '12px',
            gridAutoRows: 'minmax(160px, auto)',
          }}
        >
          {/* Rows 1–2 col 3–6: content island spans both rows */}
          <div
            style={{
              gridColumn: '3 / span 4',
              gridRow: '1 / span 2',
              borderRadius: 'var(--bento-radius)',
              padding: 'var(--bento-padding)',
            }}
          >
            <AboutContent />
          </div>

          {/* Row 1 col 7–10: hero photo */}
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{
              gridColumn: '7 / span 4',
              gridRow: '1',
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

          {/* Row 2 col 7–10: mailto tile */}
          <MailtoTile
            style={{
              gridColumn: '7 / span 4',
              gridRow: '2',
            }}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          Stack: photo → content island → mailto (full-width)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col gap-3 px-4">

        {/* Photo */}
        <div
          className="rounded-2xl overflow-hidden relative w-full"
          style={{ aspectRatio: '4 / 3' }}
        >
          <Image
            src="/about-hero.png"
            alt="Vera & Deniz"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Content island */}
        <div
          style={{
            borderRadius: 'var(--bento-radius)',
            padding: 'var(--bento-padding)',
          }}
        >
          <AboutContent />
        </div>

        {/* Mailto — full width */}
        <MailtoTile style={{ minHeight: 96 }} />

      </div>

    </div>
  )
}
