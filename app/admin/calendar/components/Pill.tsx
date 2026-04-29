'use client'

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0"
      style={{
        backgroundColor: active ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
        color: active ? 'var(--brand-parchment)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}
