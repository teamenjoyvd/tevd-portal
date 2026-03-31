type BadgeVariant = 'active' | 'inactive' | 'pending' | 'rejected' | 'pinned' | 'type'

const BADGE_STYLES: Record<BadgeVariant, { backgroundColor: string; color: string }> = {
  active:   { backgroundColor: 'rgba(34,197,94,0.12)',  color: '#15803d' },
  inactive: { backgroundColor: 'rgba(0,0,0,0.06)',      color: 'var(--text-secondary)' },
  pending:  { backgroundColor: 'rgba(0,0,0,0.06)',      color: 'var(--text-secondary)' },
  rejected: { backgroundColor: 'rgba(188,71,73,0.10)',  color: 'var(--brand-crimson)' },
  pinned:   { backgroundColor: 'var(--brand-crimson)',  color: 'white' },
  type:     { backgroundColor: 'rgba(0,0,0,0.05)',      color: 'var(--text-secondary)' },
}

export function AdminStatusBadge({ variant, label }: { variant: BadgeVariant; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
      style={BADGE_STYLES[variant]}
    >
      {label}
    </span>
  )
}
