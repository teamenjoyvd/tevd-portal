// ── Canonical VitalSign type and recorded predicate ──────────────────────────
// Single source of truth for vital sign shape and "recorded" semantics.
// All consumers — API routes, LOS tree, profile bento — import from here.
// No consumer should inspect is_active or recorded_at directly for the
// recorded decision; call isVitalRecorded(vs) instead.

/**
 * Represents one vital sign entry as returned by any /vital-signs API endpoint.
 * Covers both surfaces: profile member view and LOS tree admin view.
 */
export type VitalSign = {
  definition_id: string
  label: string
  /** true = row exists with is_active=true. false = row absent or deactivated. */
  is_active: boolean
  /** recorded_at from member_vital_signs; null when no row exists or row is inactive. */
  recorded_at: string | null
  note: string | null
}

/**
 * The canonical "recorded" predicate.
 * A vital sign is recorded if and only if a row exists AND is_active=true.
 * recorded_at is preserved on deactivation (no deletes), so it cannot be
 * used as the sole signal — a deactivated row has a non-null recorded_at.
 */
export function isVitalRecorded(vs: Pick<VitalSign, 'is_active'>): boolean {
  return vs.is_active
}
