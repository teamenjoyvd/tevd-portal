'use client'

import { useMemo, useState } from 'react'
import { useLanguage } from '@/lib/hooks/useLanguage'
import {
  RELATION_ORDER, displayNameOf, rowKeyOf,
  type Beneficiary, type BeneficiaryRelation,
} from './types'
import { MAX_GUEST_EMAIL_LENGTH, MAX_GUEST_NAME_LENGTH } from '@/lib/payments/eligibility'

/** Cap on rendered rows. A core with a large leg can return hundreds; the
 *  search narrows them long before scrolling would. */
const MAX_ROWS = 50

/** Ties the required-name message to the name input via aria-describedby. Only
 *  one add-guest form is ever mounted, so a constant id cannot collide. */
const GUEST_NAME_ERROR_ID = 'beneficiary-picker-guest-name-error'

type Props = {
  beneficiaries: Beneficiary[]
  /** Already-chosen row keys — shown as disabled so a double tap cannot duplicate a row. */
  selectedIds: string[]
  onSelect: (b: Beneficiary) => void
  /** Adds an ad-hoc guest with no account (2607-DEV-677). */
  onAddGuest: (name: string, email: string | null) => void
  onBack: () => void
  isLoading?: boolean
  /** Set when the typed guest is already on this payment — shown under the form. */
  addGuestError?: string | null
}

function initialsOf(b: Beneficiary): string {
  if (b.kind === 'profile') {
    return `${b.first_name.charAt(0)}${b.last_name.charAt(0)}`.toUpperCase()
  }
  // A guest is one free-text field, so the second initial comes from the second
  // word when there is one — "Ivan Petrov" -> IP, "Ivan" -> I.
  const [first = '', second = ''] = b.name.trim().split(/\s+/)
  return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
}

/** What a row is searched by: name and ABO for a profile, name and email for a guest. */
function searchHaystack(b: Beneficiary): string {
  return b.kind === 'profile'
    ? `${b.first_name} ${b.last_name} ${b.abo_number ?? ''}`.toLowerCase()
    : `${b.name} ${b.email ?? ''}`.toLowerCase()
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
export function BeneficiaryPicker({
  beneficiaries, selectedIds, onSelect, onAddGuest, onBack, isLoading, addGuestError,
}: Props) {
  const { t, lang } = useLanguage()
  const [search, setSearch] = useState('')

  // The inline add-a-guest form, closed until asked for.
  const [addingGuest, setAddingGuest] = useState(false)
  const [guestName, setGuestName]     = useState('')
  const [guestEmail, setGuestEmail]   = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const relationLabel: Record<BeneficiaryRelation, string> = {
    self:      t('payment.relSelf'),
    household: t('payment.relHousehold'),
    downline:  t('payment.relDownline'),
    guest:     t('payment.relGuest'),
    external:  t('payment.relExternal'),
  }

  const { sections, matchCount } = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const matches = needle
      ? beneficiaries.filter(b => searchHaystack(b).includes(needle))
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
            const key = rowKeyOf(b)
            const isSelected = selected.has(key)
            return (
              <button
                key={key}
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
                  {initialsOf(b)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {displayNameOf(b)}
                  </span>
                  <span className="block text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {/* An ABO-less co-owner, or a guest with no email, has nothing
                        to show before the relation — never a bare separator. */}
                    {b.kind === 'profile'
                      ? `${b.abo_number ? `${b.abo_number} · ` : ''}${relationLabel[b.relation]}`
                      : `${b.email ? `${b.email} · ` : ''}${relationLabel[b.relation]}`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}

      {/* Also rendered with the form CLOSED. The duplicate verdict has a second
          source — tapping a remembered guest who is already on the payment under
          a re-typed draft key (PaymentForm's onSelect) — and that path leaves
          `addingGuest` false. Shown only inside the form, that tap would return
          in silence, and the row cannot be disabled instead because
          `selectedIds` holds row keys and the duplicate carries a different one. */}
      {addGuestError != null && addGuestError !== '' && !addingGuest && (
        <p className="text-[11px] px-1" style={{ color: '#bc4749' }} role="alert">
          {addGuestError}
        </p>
      )}

      {/* The way out when the person is in no list above, because they have no
          account at all (2607-DEV-677). Pinned below the sections so it never
          pushes real matches off a 390px screen, and always rendered — a search
          that matches nothing is exactly when it is needed most. */}
      {!isLoading && !addingGuest && (
        <button
          type="button"
          onClick={() => setAddingGuest(true)}
          className="w-full flex items-center justify-center rounded-xl px-3 text-xs font-semibold transition-opacity hover:opacity-70"
          style={{
            minHeight: '44px',
            border: '1px dashed var(--border-default)',
            background: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {t('payment.addGuest')}
        </button>
      )}

      {!isLoading && addingGuest && (
        <div
          className="space-y-2 rounded-container p-3"
          style={{ border: '1px dashed var(--border-default)' }}
        >
          <input
            autoFocus
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            // Capped at the same length as payment_guests_name_check, so the
            // field cannot accept something the database will refuse.
            maxLength={MAX_GUEST_NAME_LENGTH}
            placeholder={t('payment.guestName')}
            // A placeholder is not an accessible name — it disappears on the
            // first keystroke and screen readers are not required to announce
            // it. aria-describedby wires the required-name message below to
            // this field, which is otherwise unreachable from it.
            aria-label={t('payment.guestName')}
            aria-invalid={nameTouched && guestName.trim() === ''}
            aria-describedby={
              nameTouched && guestName.trim() === '' ? GUEST_NAME_ERROR_ID : undefined
            }
            className="w-full border rounded-xl px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-global)',
              outline: 'none',
            }}
          />
          <input
            type="email"
            value={guestEmail}
            onChange={e => setGuestEmail(e.target.value)}
            maxLength={MAX_GUEST_EMAIL_LENGTH}
            placeholder={t('payment.guestEmail')}
            aria-label={t('payment.guestEmail')}
            className="w-full border rounded-xl px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-global)',
              outline: 'none',
            }}
          />

          {nameTouched && guestName.trim() === '' && (
            <p id={GUEST_NAME_ERROR_ID} className="text-[11px]" style={{ color: '#bc4749' }}>
              {t('payment.guestNameRequired')}
            </p>
          )}
          {/* Explicit null/empty test, not truthiness: the prop is string | null
              and '' is not a message worth reserving a line for. */}
          {addGuestError != null && addGuestError !== '' && (
            <p className="text-[11px]" style={{ color: '#bc4749' }} role="alert">
              {addGuestError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAddingGuest(false)
                setGuestName(''); setGuestEmail(''); setNameTouched(false)
              }}
              className="flex-1 rounded-xl text-xs font-semibold transition-opacity hover:opacity-70"
              style={{
                minHeight: '44px',
                background: 'none',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('payment.cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                const name = guestName.trim()
                setNameTouched(true)
                if (name === '') return
                // The parent owns the outcome: on a duplicate it re-renders this
                // form with addGuestError set, so the typed text stays put and
                // can be corrected rather than being thrown away.
                onAddGuest(name, guestEmail.trim() || null)
              }}
              className="flex-1 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                minHeight: '44px',
                backgroundColor: 'var(--brand-forest)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('payment.guestAdd')}
            </button>
          </div>
        </div>
      )}

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
