type BadgeVariant = 'active' | 'inactive' | 'pending' | 'rejected' | 'pinned' | 'type'

const BADGE_STYLES: Record<BadgeVariant, { backgroundColor: string; color: string }> = {
  active:   { backgroundColor: 'var(--status-success-bg)',  color: 'var(--status-success-fg)' },
  inactive: { backgroundColor: 'var(--hover-surface)',      color: 'var(--text-secondary)' },
  pending:  { backgroundColor: 'var(--hover-surface)',      color: 'var(--text-secondary)' },
  rejected: { backgroundColor: 'var(--status-alert-bg)',  color: 'var(--status-alert-fg)' },
  pinned:   { backgroundColor: 'var(--brand-crimson)',  color: 'var(--on-accent)' },
  type:     { backgroundColor: 'var(--hover-surface)',      color: 'var(--text-secondary)' },
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
