'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { formatCurrency } from '@/lib/format'
import { isBalanced, sumCents, type SplitRow } from '@/lib/payments/split'
import type { Beneficiary } from './types'

type Props = {
  rows: SplitRow[]
  /** Lookup for the display name of each row, keyed by profile_id. */
  people: Record<string, Beneficiary>
  totalCents: number
  currency: string
  /** Called with the row's new amount in integer cents; the caller locks and redistributes. */
  onChangeAmount: (profileId: string, amountCents: number) => void
  onRemove: (profileId: string) => void
}

/**
 * Per-beneficiary breakdown of an on-behalf payment (2607-DEV-676).
 *
 * The running total is shown against the required total and turns crimson the
 * moment they diverge — the submit button is gated on exact equality, so the
 * user is never left guessing why it is disabled.
 *
 * Amounts are held in integer cents throughout. The euro string in the input is
 * only a rendering of that, parsed back with Math.round so a trailing "1.005"
 * cannot smuggle a fraction of a cent into the payload.
 */
export function SplitEditor({ rows, people, totalCents, currency, onChangeAmount, onRemove }: Props) {
  const { t } = useLanguage()

  // Raw text per row while the user is typing, keyed by profile_id. Without it
  // the input is fully controlled on (amountCents / 100).toFixed(2), so every
  // keystroke reformats: typing "5" renders "5.00", the next digit makes
  // "5.000" which parses back to 5 and renders "5.00" again — "50.00" can never
  // be typed, and clearing the field snaps to "0.00". A row leaves the draft on
  // blur, at which point the canonical formatted value takes over again.
  const [draft, setDraft] = useState<Record<string, string>>({})

  const currentCents = sumCents(rows)
  const balanced = isBalanced(rows, totalCents)

  return (
    <div className="space-y-2">
      <label
        className="block text-xs font-semibold"
        style={{ color: 'var(--text-secondary)' }}
      >
        {t('payment.breakdown')}
      </label>

      {rows.map(row => {
        const person = people[row.profileId]
        return (
          <div
            key={row.profileId}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-global)',
            }}
          >
            <span className="min-w-0 flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {person ? `${person.first_name} ${person.last_name}` : row.profileId}
              {/* Marks a hand-typed row, which redistribution will not move. */}
              {row.locked && (
                <svg
                  className="inline-block ml-1.5 align-baseline" aria-hidden="true"
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              )}
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft[row.profileId] ?? (row.amountCents / 100).toFixed(2)}
              onChange={e => {
                const next = e.target.value
                setDraft(d => ({ ...d, [row.profileId]: next }))
                // An empty or half-typed field ("", "5.", "-") is a transient
                // state, not an edit to 0 — committing it would zero the row and
                // redistribute under the user mid-keystroke. Number.isNaN, never
                // truthiness: 0 itself is a legitimate share.
                if (next === '') return
                const parsed = Number.parseFloat(next)
                if (Number.isNaN(parsed) || parsed < 0) return
                onChangeAmount(row.profileId, Math.round(parsed * 100))
              }}
              onBlur={() => {
                // Leaving the field empty means 0 — commit it now that the user
                // has finished, then drop the draft so the row renders canonical.
                if (draft[row.profileId] === '') onChangeAmount(row.profileId, 0)
                setDraft(d => {
                  const next = { ...d }
                  delete next[row.profileId]
                  return next
                })
              }}
              className="text-sm text-right rounded-lg px-2 py-1"
              style={{
                width: '5.5rem',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />

            {/* The last participant cannot be removed — a payment needs someone
                to be for, and the form falls back to today's behaviour at one. */}
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(row.profileId)}
                aria-label={t('payment.remove')}
                className="flex-shrink-0 flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{
                  width: '32px', height: '32px',
                  background: 'none', border: 'none',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )
      })}

      <div className="flex items-center justify-between pt-1 text-xs">
        <span style={{ color: 'var(--text-secondary)' }}>Σ</span>
        <span
          className="font-semibold"
          style={{ color: balanced ? 'var(--text-primary)' : '#bc4749' }}
        >
          {formatCurrency(currentCents / 100, currency)} / {formatCurrency(totalCents / 100, currency)}
        </span>
      </div>

      {!balanced && (
        <p className="text-xs" style={{ color: '#bc4749' }}>
          {t('payment.mustSumToTotal')}
        </p>
      )}
    </div>
  )
}
