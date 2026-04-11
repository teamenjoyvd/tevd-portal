import Image from 'next/image'

export default function HeroTile() {
  return (
    <>
      {/* Founders image — pinned bottom-right, height 100%, slight right crop */}
      <div className="absolute inset-y-0 right-0 w-full pointer-events-none select-none">
        <Image
          src="/founders-hero.png"
          alt=""
          fill
          className="object-cover object-right-bottom"
          priority
          aria-hidden
        />
      </div>

      {/* Text block — bottom-left, hard-capped at 58% width */}
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
