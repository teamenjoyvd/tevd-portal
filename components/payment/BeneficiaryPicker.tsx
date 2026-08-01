'use client'

import { useMemo, useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import { RELATION_ORDER, type Beneficiary, type BeneficiaryRelation } from './types'

/** Cap on rendered rows. A core with a large leg can return hundreds; the
 *  search narrows them long before scrolling would. */
const MAX_ROWS = 50

type Props = {
  beneficiaries: Beneficiary[]
  /** Already-chosen ids — shown as disabled so a double tap cannot duplicate a row. */
  selectedIds: string[]
  onSelect: (b: Beneficiary) => void
  onBack: () => void
  isLoading?: boolean
}

function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

/**
 * Beneficiary picker (2607-DEV-676).
 *
 * Rendered in place of the payment form inside the SAME drawer — never as a
 * nested Drawer, because vaul fights itself over scroll-lock and z-index when
 * one is opened inside another. The chevron returns to the form.
 *
 * One tap selects and returns; there is no multi-select confirm step to get
 * wrong at 390px.
 */
export function BeneficiaryPicker({ beneficiaries, selectedIds, onSelect, onBack, isLoading }: Props) {
  const { t, lang } = useLanguage()
  const [search, setSearch] = useState('')

  const relationLabel: Record<BeneficiaryRelation, string> = {
    self:      t('payment.relSelf'),
    household: t('payment.relHousehold'),
    downline:  t('payment.relDownline'),
    guest:     t('payment.relGuest'),
  }

  const { sections, matchCount } = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle
      ? beneficiaries.filter(b =>
          `${b.first_name} ${b.last_name}`.toLowerCase().includes(needle) ||
          (b.abo_number ?? '').toLowerCase().includes(needle))
      : beneficiaries

    // Sort by relation BEFORE slicing. Capping the flat list first means that if
    // the first MAX_ROWS matches all happen to be `downline`, the `household`
    // section vanishes entirely even though those people matched — the cap
    // should trim the tail of the list, not delete whole categories.
    const ordered = [...matches].sort(
      (a, b) => RELATION_ORDER.indexOf(a.relation) - RELATION_ORDER.indexOf(b.relation),
    )
    const capped = ordered.slice(0, MAX_ROWS)
    return {
      // The notice counts MATCHES, not the unfiltered roster: after a search
      // narrows 200 people to 3, "showing the first 50" is simply false.
      matchCount: matches.length,
      sections: RELATION_ORDER
        .map(relation => ({ relation, rows: capped.filter(b => b.relation === relation) }))
        .filter(section => section.rows.length > 0),
    }
  }, [beneficiaries, search])

  const selected = new Set(selectedIds)

  return (
    <div className="space-y-3">
      {/* Sticky header: back + search, so the search stays reachable one-handed
          while the list scrolls under it at 390px. */}
      <div
        className="sticky top-0 z-10 pb-3 space-y-3"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('payment.back')}
        </button>

        <input
          // The picker view exists only to be typed into — focusing it saves a tap.
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('payment.searchNameOrAbo')}
          className="w-full border rounded-xl px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-global)',
            outline: 'none',
          }}
        />
      </div>

      {isLoading && (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.submitting')}
        </p>
      )}

      {!isLoading && sections.length === 0 && (
        <p className="text-xs py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('payment.noMatches')}
        </p>
      )}

      {sections.map(section => (
        <div key={section.relation} className="space-y-1">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide px-1 pt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {relationLabel[section.relation]}
          </p>

          {section.rows.map(b => {
            const isSelected = selected.has(b.profile_id)
            return (
              <button
                key={b.profile_id}
                type="button"
                disabled={isSelected}
                onClick={() => onSelect(b)}
                // 44px minimum touch target — the whole row is the tap area.
                className="w-full flex items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-black/[0.03]"
                style={{
                  minHeight: '44px',
                  background: 'none',
                  border: 'none',
                  cursor: isSelected ? 'not-allowed' : 'pointer',
                  opacity: isSelected ? 0.4 : 1,
                }}
              >
                <span
                  className="flex items-center justify-center rounded-full text-[11px] font-semibold flex-shrink-0"
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'var(--bg-global)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {initials(b.first_name, b.last_name)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {b.first_name} {b.last_name}
                  </span>
                  <span className="block text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {/* An ABO-less co-owner or guest has no number to show, so the
                        relation alone carries the row — never a bare separator. */}
                    {b.abo_number ? `${b.abo_number} · ` : ''}{relationLabel[b.relation]}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {/* Honest about the cap rather than silently truncating. */}
      {!isLoading && matchCount > MAX_ROWS && (
        <p className="text-[11px] pt-1 text-center" style={{ color: 'var(--text-secondary)' }}>
          {lang === 'bg'
            ? `Показани са първите ${MAX_ROWS}. Използвайте търсенето.`
            : `Showing the first ${MAX_ROWS}. Use search to narrow.`}
        </p>
      )}
    </div>
  )
}
