/**
 * Status colour maps for the calendar event popup.
 *
 * Every entry resolves to a `--status-*` token PAIR (bg + fg) from
 * styles/brand-tokens.css, which is redefined under [data-theme="dark"].
 * These were hardcoded light-mode hexes, so the popup was unreadable on dark.
 * Never reintroduce a literal here — and never a Tailwind `dark:` class:
 * this project toggles data-theme on <html>, so `dark:` tracks the OS setting
 * instead. See docs/design/DESIGN-SYSTEM.md.
 */

export const SLOT_STATUS_STYLES = {
  open:      { bg: 'var(--status-neutral-bg)', color: 'var(--status-neutral-fg)' },
  contested: { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' },
  filled:    { bg: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
}

export const REQUEST_STATUS_STYLES = {
  pending:  { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' },
  approved: { bg: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
  denied:   { bg: 'var(--status-alert-bg)',   color: 'var(--status-alert-fg)'   },
}

export const REGISTRATION_STATUS_STYLES = {
  attended:  { bg: 'var(--status-success-bg)', color: 'var(--status-success-fg)' },
  cancelled: { bg: 'var(--status-alert-bg)',   color: 'var(--status-alert-fg)'   },
  confirmed: { bg: 'var(--status-info-bg)',    color: 'var(--status-info-fg)'    },
  pending:   { bg: 'var(--status-pending-bg)', color: 'var(--status-pending-fg)' },
}
