'use client'

// Shared primitive: language tab switcher.
// Used by AnnouncementsTab (create + edit).

type LangTabsProps = {
  langs: string[]
  active: string
  onChange: (lang: string) => void
}

export function LangTabs({ langs, active, onChange }: LangTabsProps) {
  return (
    <div className="flex gap-2" role="tablist">
      {langs.map(l => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={active === l}
          onClick={() => onChange(l)}
          className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: active === l ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
            color: active === l ? 'white' : 'var(--text-secondary)',
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
