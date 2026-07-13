export function LosUploadSection() {
  return (
    <div className="rounded-2xl p-6 h-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-4 pr-16" style={{ color: 'var(--brand-teal)' }}>My LOS</p>
      <a href="/profile/los-upload"
        style={{ backgroundColor: 'var(--brand-forest)', color: 'var(--brand-parchment)' }}
        className="rounded-xl px-4 py-3 inline-flex flex-col gap-1 hover:opacity-80 transition-opacity">
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--brand-parchment)' }}>Upload my LOS</span>
        <span className="text-[10px] opacity-60" style={{ color: 'var(--brand-parchment)' }}>Submit your downline for review</span>
      </a>
    </div>
  )
}
