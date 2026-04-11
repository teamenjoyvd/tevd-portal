import Image from 'next/image'

export default function HeroTile() {
  return (
    <>
      {/*
        Founders image — occupies right 65% of the card, full height, bleeds off right edge.
        `fill` requires a positioned ancestor with explicit dimensions — that's the BentoCard
        wrapper which has `relative overflow-hidden` and a defined grid row height (desktop: 2×row,
        mobile: minHeight 200px). The inner div is absolutely positioned to cover only the right
        portion so the image doesn't fight with the text on the left.
      */}
      <div
        className="absolute inset-y-0 right-0 pointer-events-none select-none"
        style={{ width: '65%' }}
        aria-hidden
      >
        <Image
          src="/founders-hero.png"
          alt=""
          fill
          sizes="(max-width: 768px) 65vw, 40vw"
          className="object-contain object-right-bottom"
          priority
        />
      </div>

      {/* Text block — bottom-left, hard-capped at 58% width so it never overlaps the image */}
      <div className="absolute inset-0 flex flex-col justify-end px-8 py-10 z-10">
        <div style={{ maxWidth: '58%' }}>
          <h1
            className="font-serif leading-tight mb-2 text-[22px] md:text-[34px]"
            style={{ fontWeight: 900, color: '#f2efe8', letterSpacing: '-0.01em' }}
          >
            TEAMENJOYVD
          </h1>
          <p
            className="font-sans text-[12px]"
            style={{ fontWeight: 300, color: 'rgba(242,239,232,0.52)', lineHeight: 1.5 }}
          >
            Entrepreneurs, dreamers, enjoying life.
          </p>
        </div>
      </div>
    </>
  )
}
