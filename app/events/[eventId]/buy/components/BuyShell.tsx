import type { ReactNode } from 'react'

export function BuyShell({ brand, title, subtitle, children }: { brand: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="min-h-screen px-5 pt-12 pb-8" style={{ backgroundColor: 'var(--bg-global)' }}>
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--status-alert-fg)' }}>{brand}</p>
        <h1 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle !== undefined && <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {children}
        </div>
      </div>
    </main>
  )
}
