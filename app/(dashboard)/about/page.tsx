import Image from 'next/image'
import AboutMapTileDynamic from './components/AboutMapTileDynamic'
import MailtoTile from './components/MailtoTile'
import AboutContent from './components/AboutContent'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div className="py-8 pb-16">

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout (md+)
          12-col CSS grid, max-w-[860px] centred
          Row 1: [1–2 gutter] [3–6 heading+content island] [7–10 photo] [11–12 gutter]
          Row 2: [1–2 gutter] [3–6 mailto]                 [7–10 map]   [11–12 gutter]
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
          {/* Row 1 col 3–6: heading + content island (transparent) */}
          <div
            style={{
              gridColumn: '3 / span 4',
              gridRow: '1',
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

          {/* Row 2 col 3–6: mailto tile */}
          <MailtoTile
            style={{
              gridColumn: '3 / span 4',
              gridRow: '2',
            }}
          />

          {/* Row 2 col 7–10: map tile */}
          <AboutMapTileDynamic
            style={{
              gridColumn: '7 / span 4',
              gridRow: '2',
              minHeight: 160,
            }}
          />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MOBILE layout (< md)
          Stack: photo → heading/content island → mailto + map (2-col row)
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

        {/* Heading + body content island */}
        <div
          style={{
            borderRadius: 'var(--bento-radius)',
            padding: 'var(--bento-padding)',
          }}
        >
          <AboutContent />
        </div>

        {/* Mailto + map side-by-side */}
        <div className="grid grid-cols-2 gap-3">
          <MailtoTile style={{ minHeight: 96 }} />
          <AboutMapTileDynamic style={{ minHeight: 96 }} />
        </div>

      </div>

    </div>
  )
}
