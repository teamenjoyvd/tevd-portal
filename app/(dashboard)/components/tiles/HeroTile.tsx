export default function HeroTile() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 40% 50%, rgba(188,71,73,0.18) 0%, transparent 70%)' }}
      />
      <div className="absolute inset-0 flex flex-col justify-end px-8 py-10 z-10">
        <h1
          className="font-display text-4xl font-semibold leading-tight mb-3"
          style={{ color: 'var(--brand-parchment)' }}
        >
          TEAMENJOYVD
        </h1>
        <p className="font-body text-base max-w-xs" style={{ color: 'rgba(242,239,232,0.65)' }}>
          Entrepreneurs, dreamers, enjoying life.
        </p>
      </div>
    </>
  )
}
