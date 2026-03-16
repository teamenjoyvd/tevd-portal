import Image from 'next/image'
import Link from 'next/link'

type Props = {
  isAuthenticated: boolean
}

export default function Hero({ isAuthenticated }: Props) {
  return (
    <div className="px-4 md:px-6 lg:px-8 pt-6 pb-2" style={{ backgroundColor: 'var(--eggshell)' }}>
      <div
        className="relative max-w-[1080px] mx-auto rounded-3xl overflow-hidden"
        style={{ minHeight: 360 }}
      >
        {/* Background image */}
        <Image
          src="/hero.png"
          alt="teamenjoyVD hero"
          fill
          className="object-cover"
          priority
        />

        {/* Gradient overlay — dark Forest-tinted, left-heavy */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(120deg, rgba(45,51,42,0.88) 0%, rgba(45,51,42,0.60) 55%, rgba(45,51,42,0.30) 100%)',
          }}
        />

        {/* Subtle radial accent */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 30%, #e07a5f 0%, transparent 45%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 px-8 md:px-14 py-14 md:py-20 flex flex-col items-start justify-end h-full"
          style={{ minHeight: 360 }}>
          <p
            className="text-xs tracking-[0.35em] uppercase font-semibold mb-3"
            style={{ color: 'var(--sienna)' }}
          >
            N21 Community
          </p>
          <h1
            className="font-serif text-4xl md:text-6xl font-bold text-white leading-tight mb-3"
          >
            TEAMENJOYVD
          </h1>
          <p
            className="font-sans text-base md:text-lg mb-8 max-w-md"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            Entrepreneurs, dreamers, enjoying life.
          </p>
          {!isAuthenticated && (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: 'var(--crimson)' }}
            >
              Sign in to your account
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}