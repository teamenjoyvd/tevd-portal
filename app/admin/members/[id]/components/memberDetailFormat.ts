export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatEur(n: number) {
  return new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export const STATUS_PILL: Record<string, string> = {
  pending:   'bg-status-pending-bg text-status-pending-fg',
  approved:  'bg-status-success-bg text-status-success-fg',
  denied:    'bg-status-alert-bg text-status-alert-fg',
  // 2608-DEV-749 — registration_status gained 'cancelled'; without a line here
  // the `?? ''` fallback at the three call sites renders an unstyled pill.
  cancelled: 'bg-hover-surface text-[var(--text-secondary)]',
  completed: 'bg-status-success-bg text-status-success-fg',
  failed:    'bg-status-alert-bg text-status-alert-fg',
}
