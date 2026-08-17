'use client'

// ── Verification nudge popup (2608-DEV-742) ──────────────────────────────────
// Homepage-only. Reads the SAME ['profile'] cache entry ProfileTile populates
// (ProfileTile.tsx:43-48) — no new API route, no new network request. Dismissal
// state lives in profiles.ui_prefs.onboarding, which already exists, so there is
// no migration either.
//
// "Confirmed" is not a column anywhere: it is derived from role + verRequest +
// the caller's own spouse-link request. This component reads that derivation, it
// does not add a new source of truth.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n/translations'
import { apiClient } from '@/lib/apiClient'
import type { Profile, OnboardingPrefs } from '../profile/types'

/** Hard stop — some people are permanently stuck (an ABO not in the LOS, a
 *  primary who will never approve). A popup with no stop condition becomes the
 *  thing users click past without reading, which costs the ability to tell them
 *  anything later. The persistent surfaces (ProfileTile, SpouseLinkBanner) carry
 *  the message from here on. */
const NUDGE_MAX_SHOWINGS = 3
/** "Remind me later" and ✕ both snooze — a close is a snooze, not a refusal. */
const NUDGE_SNOOZE_DAYS = 7
/** The bento grid runs its entrance animation on load (`.bento-tile`,
 *  globals.css:124); opening a modal into it is jarring. */
const NUDGE_DELAY_MS = 1500

const SNOOZE_MS = NUDGE_SNOOZE_DAYS * 24 * 60 * 60 * 1000

type NudgeVariant = 'verify' | 'denied' | 'approve-spouse'

/**
 * The five states from the ticket. Only 1, 3 and 5 get a popup — 2 and 4 are
 * *waiting*, not *stuck*, and a popup there is pure nagging.
 */
export function selectVariant(p: Profile): NudgeVariant | null {
  const isLinkedSecondary = (p.primary_profile_id ?? null) !== null

  if (p.role === 'guest') {
    // Already linked to a primary — nothing for them to submit.
    if (isLinkedSecondary) return null
    // State 4: waiting on their primary. Never tell them to verify an ABO —
    // verify-abo/route.ts:27-35 hard-blocks secondaries from self-verifying.
    if (p.ownSpouseLinkRequest?.status === 'pending') return null

    switch (p.verRequest?.status ?? null) {
      case 'pending':  return null          // state 2 — under review
      case 'denied':   return 'denied'      // state 3 — needs attention
      case null:       return 'verify'      // state 1 — never submitted
      default:         return null          // approved but not yet promoted
    }
  }

  // State 5 — the co-owner half. Points at the PRIMARY, who is the only person
  // able to act; nudging the applicant achieves nothing.
  if (p.pendingSpouseLinkCount > 0) return 'approve-spouse'

  // Never for member / core / admin otherwise.
  return null
}

/** Runs `run` for each queued argument strictly in call order, regardless of
 *  how long an individual run takes. Used to keep the two onboarding-prefs
 *  PATCH requests (show-count, dismiss) from landing out of order: they can
 *  fire moments apart (a dialog opens, then is immediately dismissed), and an
 *  out-of-order arrival would let the show-count write silently overwrite a
 *  dismissal's `verify_dismissed_at`, defeating the snooze. */
export function createWriteQueue<T>(run: (arg: T) => Promise<unknown>) {
  let chain: Promise<unknown> = Promise.resolve()
  return (arg: T) => {
    chain = chain.catch(() => {}).then(() => run(arg))
  }
}

/** True while the user's last dismissal is still inside the snooze window. */
export function isSnoozed(o: OnboardingPrefs | undefined, now: number): boolean {
  const dismissedAt = o?.verify_dismissed_at
  if (dismissedAt === undefined || dismissedAt === null) return false
  const parsed = Date.parse(dismissedAt)
  // A malformed timestamp must not permanently suppress the nudge.
  if (Number.isNaN(parsed)) return false
  return now - parsed < SNOOZE_MS
}

const COPY: Record<NudgeVariant, { title: TranslationKey; body: TranslationKey; cta: TranslationKey; href: string }> = {
  verify: {
    title: 'home.nudge.verify.title',
    body:  'home.nudge.verify.body',
    cta:   'home.nudge.verify.cta',
    href:  '/profile',
  },
  denied: {
    title: 'home.nudge.denied.title',
    body:  'home.nudge.denied.body',
    cta:   'home.nudge.denied.cta',
    href:  '/profile',
  },
  'approve-spouse': {
    title: 'home.nudge.spouse.title',
    body:  'home.nudge.spouse.body',
    cta:   'home.nudge.spouse.cta',
    href:  '/profile/spouse-link',
  },
}

// ── The path visual ───────────────────────────────────────────────────────────
// ✓ ─── ● ─── ○  ·  Signed up / Verify ABO / Full access
// Uses --status-success-* (done), --status-pending-* (current) and
// --status-neutral-* (upcoming): all three pairs exist and are theme-correct.

function StepPath({ t }: { t: (key: TranslationKey) => string }) {
  const steps: { key: TranslationKey; state: 'done' | 'current' | 'upcoming' }[] = [
    { key: 'home.nudge.step.signedUp',   state: 'done' },
    { key: 'home.nudge.step.verify',     state: 'current' },
    { key: 'home.nudge.step.fullAccess', state: 'upcoming' },
  ]
  const TOKEN = {
    done:     { bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)' },
    current:  { bg: 'var(--status-pending-bg)', fg: 'var(--status-pending-fg)' },
    upcoming: { bg: 'var(--status-neutral-bg)', fg: 'var(--status-neutral-fg)' },
  }
  const GLYPH = { done: '✓', current: '●', upcoming: '○' }

  return (
    <div className="flex items-start justify-between gap-1" aria-hidden="true">
      {steps.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-start gap-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: TOKEN[step.state].bg, color: TOKEN[step.state].fg }}
            >
              {GLYPH[step.state]}
            </span>
            <span
              className="text-[10px] leading-tight text-center"
              style={{ color: step.state === 'upcoming' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}
            >
              {t(step.key)}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="mt-3.5 h-px flex-1" style={{ backgroundColor: 'var(--border-default)' }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function VerifyNudgeDialog() {
  const { isSignedIn } = useUser()
  const { t } = useLanguage()
  const qc = useQueryClient()

  // Same key, staleTime and `enabled` as ProfileTile so both observers share one
  // cache entry and this mounts without issuing a request of its own.
  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile'],
    queryFn: () => apiClient('/api/profile'),
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  })

  const [open, setOpen] = useState(false)
  // Guards the showing-count write against React's double-invoked effects in
  // development and against a re-render between the timer firing and the PATCH.
  const recordedRef = useRef(false)
  const enqueueWrite = useRef(
    createWriteQueue<OnboardingPrefs>(next =>
      apiClient('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ui_prefs: { onboarding: next } }),
      }).catch(err => {
        // Non-fatal: the popup has already done its job on screen. Worst case
        // the cap is not advanced and they see it once more next session.
        console.error('[VerifyNudgeDialog] failed to persist onboarding prefs', err)
      })
    )
  ).current

  const onboarding = profile?.ui_prefs?.onboarding
  const shownCount = onboarding?.verify_shown_count ?? 0
  const variant = profile ? selectVariant(profile) : null

  const shouldShow =
    variant !== null &&
    shownCount < NUDGE_MAX_SHOWINGS &&
    !isSnoozed(onboarding, Date.now())

  /** Whole-object write: PATCH /api/profile merges ui_prefs exactly ONE level
   *  deep (route.ts:194-197), so a partial `onboarding` would drop its siblings.
   *  Top-level neighbours (bento_order, bento_collapsed, font_size,
   *  ical_display_name) are untouched by that same merge. */
  function persist(next: OnboardingPrefs) {
    // Update the cache first so a client-side navigation back to the homepage
    // re-evaluates against the new state instead of the stale one. Not an
    // invalidate: refetching here would re-render the open dialog mid-interaction.
    qc.setQueryData<Profile>(['profile'], prev =>
      prev ? { ...prev, ui_prefs: { ...prev.ui_prefs, onboarding: next } } : prev
    )
    enqueueWrite(next)
  }

  useEffect(() => {
    if (!shouldShow) return
    const timer = setTimeout(() => {
      setOpen(true)
      if (recordedRef.current) return
      recordedRef.current = true
      persist({ ...onboarding, verify_shown_count: shownCount + 1 })
    }, NUDGE_DELAY_MS)
    return () => clearTimeout(timer)
    // `onboarding`/`shownCount` are snapshotted deliberately: persist() rewrites
    // the cache entry they come from, and re-running on that would re-arm the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow])

  function dismiss() {
    setOpen(false)
    persist({
      ...onboarding,
      verify_shown_count: Math.max(shownCount, 1),
      verify_dismissed_at: new Date().toISOString(),
    })
  }

  // Render nothing while the profile query is loading rather than flashing the
  // wrong state (profile prerender gotcha).
  if (!profile || variant === null) return null

  const copy = COPY[variant]
  const adminNote = variant === 'denied' ? profile.verRequest?.admin_note ?? null : null

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) dismiss() }}>
      <DialogPortal>
        <DialogOverlay className="nudge-motion" style={{ backgroundColor: 'var(--overlay)' }} />
        <DialogContent
          className="nudge-motion fixed flex flex-col overflow-hidden p-5 gap-4
            inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-container
            md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[380px] md:max-h-[80vh] md:rounded-container md:-translate-x-1/2 md:-translate-y-1/2"
          style={{ backgroundColor: 'var(--bg-global)' }}
        >
          <div className="flex items-start gap-3">
            <DialogTitle className="text-lg" style={{ color: 'var(--text-primary)' }}>
              {t(copy.title)}
            </DialogTitle>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('home.nudge.close')}
              className="ml-auto -mr-1 -mt-1 shrink-0 rounded-control p-1 hover:bg-hover-surface"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {variant !== 'approve-spouse' && <StepPath t={t} />}

          <DialogDescription className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t(copy.body)}
          </DialogDescription>

          {adminNote !== null && adminNote !== '' && (
            <p
              className="text-xs rounded-control px-3 py-2"
              style={{ backgroundColor: 'var(--status-alert-bg)', color: 'var(--status-alert-fg)' }}
            >
              {adminNote}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full">
              <Link href={copy.href} onClick={dismiss}>{t(copy.cta)}</Link>
            </Button>
            <Button variant="ghost" className="w-full" onClick={dismiss}>
              {t('home.nudge.later')}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
