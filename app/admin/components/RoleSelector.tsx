'use client'

// Shared primitive: role toggle pill buttons.
// Used by AnnouncementsTab (create + edit) and GuideForm.

type RoleSelectorProps = {
  roles: string[]
  selected: string[]
  onChange: (roles: string[]) => void
}

export function RoleSelector({ roles, selected, onChange }: RoleSelectorProps) {
  function toggle(role: string) {
    onChange(
      selected.includes(role)
        ? selected.filter(r => r !== role)
        : [...selected, role]
    )
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {roles.map(role => (
        <button
          key={role}
          type="button"
          aria-pressed={selected.includes(role)}
          onClick={() => toggle(role)}
          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={{
            backgroundColor: selected.includes(role) ? 'var(--brand-forest)' : 'rgba(0,0,0,0.06)',
            color: selected.includes(role) ? 'var(--brand-parchment)' : 'var(--text-secondary)',
          }}
        >
          {role}
        </button>
      ))}
    </div>
  )
}
