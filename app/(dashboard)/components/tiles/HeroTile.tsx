import Image from 'next/image'

export default function HeroTile() {
  return (
    <>
      {/*
        Founders image — occupies right 40% of the card, full height, bleeds off right edge.
        `fill` requires a positioned ancestor with explicit dimensions — that's the BentoCard
        wrapper which has `relative overflow-hidden` and a defined grid row height (desktop: 2×row,
        mobile: minHeight 200px). The inner div is absolutely positioned to cover only the right
        portion so the image doesn't fight with the text on the left.
      */}
      <div
        className="absolute inset-y-0 right-0 pointer-events-none select-none"
        style={{ width: '40%' }}
        aria-hidden
      >
        <Image
          src="/founders-hero.png"
          alt=""
          fill
          sizes="(max-width: 768px) 40vw, 27vw"
          className="object-contain object-right-bottom"
          priority
        />
      </div>

      {/* Text block — bottom-left, hard-capped at 58% width so it never overlaps the image */}
      <div className="absolute inset-0 flex flex-col justify-end px-8 py-10 z-10">
        <div className="max-w-[58%]">
          <h1
            className="font-serif leading-tight mb-2 text-[22px] md:text-[34px] font-black text-brand-parchment tracking-[-0.01em]"
          >
            TEAMENJOYVD
          </h1>
          <p className="font-sans text-xs font-light text-brand-parchment/[0.52] leading-normal">
            Entrepreneurs, dreamers, enjoying life.
          </p>
        </div>
      </div>
    </>
  )
}
